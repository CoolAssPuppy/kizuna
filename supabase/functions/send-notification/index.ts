// deno-lint-ignore-file no-explicit-any
// Edge function: send-notification
//
// One channel router for every transactional notification Kizuna emits.
// Admin POSTs:
//   {
//     userId,           // recipient
//     channel,          // 'slack' | 'email' | 'in_app'
//     type,             // notification_type enum
//     subject,
//     body,
//     taskId            // optional, for nudge rate limiting
//   }
//
// Behaviour:
//   - For task-bound nudges, refuses if the last nudge was within 3 days.
//   - Picks a driver: Slack DM (graceful when unkeyed), Resend email
//     (graceful when unkeyed). Always inserts a row in `notifications`
//     so the admin nudge log is complete.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

interface NotificationInput {
  userId: string;
  channel: 'slack' | 'email' | 'in_app';
  type:
    | 'nudge'
    | 'deadline_reminder'
    | 'flight_update'
    | 'room_assignment'
    | 'announcement'
    | 'checkin_reminder';
  subject: string;
  body: string;
  taskId?: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const senderId = userData.user.id;
  const role = (userData.user.app_metadata as Record<string, unknown> | undefined)?.['app_role'];
  if (role !== 'admin' && role !== 'super_admin') {
    return jsonResponse({ error: 'forbidden' }, { status: 403 });
  }

  let payload: NotificationInput;
  try {
    payload = (await req.json()) as NotificationInput;
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Rate-limit task-scoped nudges to one per 3 days.
  if (payload.taskId) {
    const { data: task } = await admin
      .from('registration_tasks')
      .select('last_nudge_at')
      .eq('id', payload.taskId)
      .maybeSingle();
    if (task?.last_nudge_at) {
      const last = new Date(task.last_nudge_at).getTime();
      if (Date.now() - last < THREE_DAYS_MS) {
        return jsonResponse({ error: 'rate_limited' }, { status: 429 });
      }
    }
  }

  let delivered = false;
  try {
    if (payload.channel === 'slack') {
      delivered = await sendViaSlack(admin, payload);
    } else if (payload.channel === 'email') {
      delivered = await sendViaResend(admin, payload);
    } else {
      delivered = true; // in-app: just write the notifications row
    }
  } catch (err: unknown) {
    console.warn('[kizuna] send-notification driver failed', err);
  }

  // Append to the audit log regardless of delivery success.
  await admin.from('notifications').insert({
    user_id: payload.userId,
    channel: payload.channel,
    notification_type: payload.type,
    task_id: payload.taskId ?? null,
    subject: payload.subject,
    body: payload.body,
    delivered,
    sent_by: senderId,
  });

  if (payload.taskId) {
    await admin
      .from('registration_tasks')
      .update({
        last_nudge_at: new Date().toISOString(),
        nudge_count: (await currentNudgeCount(admin, payload.taskId)) + 1,
      })
      .eq('id', payload.taskId);
  }

  return jsonResponse({ delivered });
});

async function currentNudgeCount(admin: any, taskId: string): Promise<number> {
  const { data } = await admin
    .from('registration_tasks')
    .select('nudge_count')
    .eq('id', taskId)
    .maybeSingle();
  return (data?.nudge_count as number | null) ?? 0;
}

async function sendViaSlack(admin: any, payload: NotificationInput): Promise<boolean> {
  const token = Deno.env.get('SLACK_BOT_TOKEN');
  const { data: profile } = await admin
    .from('employee_profiles')
    .select('slack_handle')
    .eq('user_id', payload.userId)
    .maybeSingle();
  const handle = profile?.slack_handle as string | null;

  if (!token) {
    console.info('[kizuna] SLACK_BOT_TOKEN missing — would have DM\'d %s', handle ?? payload.userId);
    return true;
  }
  if (!handle) return false;

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      channel: handle.startsWith('@') ? handle : `@${handle}`,
      text: `*${payload.subject}*\n${payload.body}`,
    }),
  });
  const body = (await response.json()) as { ok?: boolean };
  return body.ok === true;
}

async function sendViaResend(admin: any, payload: NotificationInput): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@kizuna.example';
  const { data: user } = await admin
    .from('users')
    .select('email')
    .eq('id', payload.userId)
    .maybeSingle();
  const to = user?.email as string | null;

  if (!apiKey) {
    console.info('[kizuna] RESEND_API_KEY missing — would have emailed %s', to ?? payload.userId);
    return true;
  }
  if (!to) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: payload.subject,
      text: payload.body,
    }),
  });
  return response.ok;
}
