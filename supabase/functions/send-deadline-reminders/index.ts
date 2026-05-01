// send-deadline-reminders edge function
//
// Cron-triggered. Walks open registrations whose event closes within
// the next 7 days, finds pending registration_tasks that have not been
// nudged in the last 3 days, and pushes a notification per task via the
// channel that matches the user's role (Slack for employees, email for
// guests). Always writes a row to `notifications` so the audit log is
// complete, and stamps `registration_tasks.last_nudge_at` so the rate
// limit holds across runs.
//
// Auth model: cron passes a shared secret in the X-Cron-Secret header.
// Locally, the secret defaults to "dev-cron-secret" so manual runs are
// trivial. Production sets CRON_SECRET on the function and on the cron
// trigger itself — anyone hitting the URL without it gets 401.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (k: string) => string | undefined };
};

const NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

interface OpenTask {
  task_id: string;
  task_key: string;
  user_id: string;
  user_email: string;
  user_role: string;
  slack_handle: string | null;
  event_id: string;
  event_name: string;
  event_close: string;
  last_nudge_at: string | null;
}

async function loadOpenTasks(client: SupabaseClient): Promise<OpenTask[]> {
  const horizon = new Date(Date.now() + REMINDER_HORIZON_MS).toISOString();
  // Single query with joins so we don't issue N+1.
  const { data, error } = await client
    .from('registration_tasks')
    .select(
      `
      id, task_key, status, last_nudge_at,
      registrations (
        event_id,
        events ( id, name, reg_closes_at ),
        users (
          id, email, role,
          employee_profiles ( slack_handle )
        )
      )
    `,
    )
    .eq('status', 'pending')
    .order('last_nudge_at', { ascending: true, nullsFirst: true });
  if (error) throw error;

  const out: OpenTask[] = [];
  for (const row of data ?? []) {
    const reg = row.registrations;
    const event = reg?.events;
    const user = reg?.users;
    if (!reg || !event || !user) continue;
    if (!event.reg_closes_at || event.reg_closes_at > horizon) continue;
    const employee = user.employee_profiles;
    out.push({
      task_id: row.id,
      task_key: row.task_key,
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      slack_handle: employee?.slack_handle ?? null,
      event_id: event.id,
      event_name: event.name,
      event_close: event.reg_closes_at,
      last_nudge_at: row.last_nudge_at,
    });
  }
  return out;
}

function isNudgeAllowed(task: OpenTask): boolean {
  if (!task.last_nudge_at) return true;
  return Date.now() - new Date(task.last_nudge_at).getTime() >= NUDGE_COOLDOWN_MS;
}

function pickChannel(task: OpenTask): 'slack' | 'email' | 'in_app' {
  if (task.user_role === 'employee' && task.slack_handle) return 'slack';
  return 'email';
}

function compose(task: OpenTask): { subject: string; body: string } {
  const closeDate = new Date(task.event_close).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return {
    subject: `Finish your ${task.event_name} registration`,
    body: `Hi! Your ${task.task_key.replaceAll('_', ' ')} step is still pending. Please complete it before ${closeDate}.`,
  };
}

async function sendViaSlack(task: OpenTask, subject: string, body: string): Promise<boolean> {
  const token = Deno.env.get('SLACK_BOT_TOKEN');
  if (!token) {
    console.info('[deadline-reminders] SLACK_BOT_TOKEN missing — skipping send');
    return true;
  }
  if (!task.slack_handle) return false;
  const handle = task.slack_handle.startsWith('@') ? task.slack_handle : `@${task.slack_handle}`;
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: handle, text: `*${subject}*\n${body}` }),
  });
  const json = (await response.json()) as { ok?: boolean };
  return json.ok === true;
}

async function sendViaResend(task: OpenTask, subject: string, body: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@kizuna.example';
  if (!apiKey) {
    console.info('[deadline-reminders] RESEND_API_KEY missing — skipping send');
    return true;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: task.user_email, subject, text: body }),
  });
  return response.ok;
}

async function processTask(client: SupabaseClient, task: OpenTask): Promise<boolean> {
  const channel = pickChannel(task);
  const { subject, body } = compose(task);

  let delivered = true;
  try {
    if (channel === 'slack') delivered = await sendViaSlack(task, subject, body);
    else if (channel === 'email') delivered = await sendViaResend(task, subject, body);
  } catch (err) {
    console.warn('[deadline-reminders] driver failed', err);
    delivered = false;
  }

  await client.from('notifications').insert({
    user_id: task.user_id,
    event_id: task.event_id,
    channel,
    notification_type: 'deadline_reminder',
    task_id: task.task_id,
    subject,
    body,
    delivered,
  });

  await client
    .from('registration_tasks')
    .update({ last_nudge_at: new Date().toISOString() })
    .eq('id', task.task_id);

  return delivered;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const expected = Deno.env.get('CRON_SECRET') ?? 'dev-cron-secret';
  if (req.headers.get('x-cron-secret') !== expected) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'server_misconfigured' }, { status: 500 });
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let scanned = 0;
  let sent = 0;
  let skippedRateLimit = 0;

  try {
    const tasks = await loadOpenTasks(client);
    scanned = tasks.length;
    for (const task of tasks) {
      if (!isNudgeAllowed(task)) {
        skippedRateLimit += 1;
        continue;
      }
      const delivered = await processTask(client, task);
      if (delivered) sent += 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[deadline-reminders] failure', message);
    return jsonResponse({ error: message }, { status: 500 });
  }

  return jsonResponse({ scanned, sent, skipped_rate_limit: skippedRateLimit });
});
