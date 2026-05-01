// Slack and Resend driver helpers for edge functions.
//
// Two functions need to send via Slack DM or Resend email:
// `send-notification` (admin-triggered) and `send-deadline-reminders`
// (cron). Centralising the raw fetch + stub-when-unkeyed behaviour
// here keeps the message format and the success check consistent.

declare const Deno: { env: { get: (k: string) => string | undefined } };

interface SlackInput {
  handle: string | null;
  subject: string;
  body: string;
}

/**
 * Sends a Slack DM. Returns true on success or stubbed (no token).
 * Returns false if the handle is missing — callers can record that as
 * a soft delivery failure without bubbling an error.
 */
export async function sendSlackDm(input: SlackInput): Promise<boolean> {
  const token = Deno.env.get('SLACK_BOT_TOKEN');
  if (!token) {
    console.info('[kizuna] SLACK_BOT_TOKEN missing — would have DM\'d %s', input.handle ?? '(no handle)');
    return true;
  }
  if (!input.handle) return false;
  const channel = input.handle.startsWith('@') ? input.handle : `@${input.handle}`;
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel, text: `*${input.subject}*\n${input.body}` }),
  });
  const json = (await response.json()) as { ok?: boolean };
  return json.ok === true;
}

interface ResendInput {
  to: string | null;
  subject: string;
  /** Plain-text body. Either this or `html` must be set. */
  body?: string;
  /** HTML body. Either this or `body` must be set. */
  html?: string;
}

/**
 * Sends a transactional email via Resend. Stub-success when unkeyed.
 * Returns false if `to` is missing.
 */
export async function sendResendEmail(input: ResendInput): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@kizuna.example';
  if (!apiKey) {
    console.info('[kizuna] RESEND_API_KEY missing — would have emailed %s', input.to ?? '(no email)');
    return true;
  }
  if (!input.to) return false;
  const payload: Record<string, unknown> = { from, to: input.to, subject: input.subject };
  if (input.html) payload['html'] = input.html;
  if (input.body) payload['text'] = input.body;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.ok;
}
