// send-deadline-reminders edge function
//
// Cron-triggered. Walks open registrations whose event closes within
// the next 7 days, finds pending registration_tasks that have not been
// nudged in the last 3 days, and pushes a notification per task via
// the channel that matches the user's role (Slack for employees with
// a slack_handle, email otherwise). Always writes a row to
// `notifications` so the audit log is complete, and stamps
// `registration_tasks.last_nudge_at` so the rate limit holds across
// runs.
//
// Auth model: cron passes a shared secret in the X-Cron-Secret header.
// Locally the secret defaults to "dev-cron-secret"; production sets
// CRON_SECRET on the function and on the cron trigger itself.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { NUDGE_COOLDOWN_MS, REMINDER_HORIZON_MS } from '../_shared/constants.ts';
import { sendResendEmail, sendSlackDm } from '../_shared/notify.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (k: string) => string | undefined };
};

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

async function processTask(client: SupabaseClient, task: OpenTask): Promise<boolean> {
  const channel = pickChannel(task);
  const { subject, body } = compose(task);

  let delivered = true;
  try {
    if (channel === 'slack') {
      delivered = await sendSlackDm({ handle: task.slack_handle, subject, body });
    } else {
      delivered = await sendResendEmail({ to: task.user_email, subject, body });
    }
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

  const client = getAdminClient();
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
