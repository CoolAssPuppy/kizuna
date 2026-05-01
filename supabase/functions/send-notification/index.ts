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

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { requireAdmin } from '../_shared/adminGuard.ts';
import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { NUDGE_COOLDOWN_MS } from '../_shared/constants.ts';
import { sendResendEmail, sendSlackDm } from '../_shared/notify.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };

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

  const guard = await requireAdmin(req);
  if (guard instanceof Response) return guard;
  const senderId = guard.userId;

  let payload: NotificationInput;
  try {
    payload = (await req.json()) as NotificationInput;
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }

  const admin = getAdminClient();

  // Rate-limit task-scoped nudges to one per cooldown window.
  if (payload.taskId) {
    const { data: task } = await admin
      .from('registration_tasks')
      .select('last_nudge_at')
      .eq('id', payload.taskId)
      .maybeSingle();
    if (task?.last_nudge_at) {
      const last = new Date(task.last_nudge_at).getTime();
      if (Date.now() - last < NUDGE_COOLDOWN_MS) {
        return jsonResponse({ error: 'rate_limited' }, { status: 429 });
      }
    }
  }

  let delivered = false;
  try {
    if (payload.channel === 'slack') {
      const handle = await loadSlackHandle(admin, payload.userId);
      delivered = await sendSlackDm({ handle, subject: payload.subject, body: payload.body });
    } else if (payload.channel === 'email') {
      const to = await loadEmail(admin, payload.userId);
      delivered = await sendResendEmail({ to, subject: payload.subject, body: payload.body });
    } else {
      delivered = true; // in-app: just write the notifications row
    }
  } catch (err) {
    console.warn('[kizuna] send-notification driver failed', err);
  }

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

async function currentNudgeCount(admin: SupabaseClient, taskId: string): Promise<number> {
  const { data } = await admin
    .from('registration_tasks')
    .select('nudge_count')
    .eq('id', taskId)
    .maybeSingle();
  return (data?.nudge_count as number | null) ?? 0;
}

async function loadSlackHandle(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('employee_profiles')
    .select('slack_handle')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.slack_handle as string | null) ?? null;
}

async function loadEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from('users').select('email').eq('id', userId).maybeSingle();
  return (data?.email as string | null) ?? null;
}
