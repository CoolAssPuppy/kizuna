/**
 * Resend email wrapper.
 *
 * The browser bundle never sends email directly — production calls happen
 * inside Supabase Edge Functions where RESEND_API_KEY is available. This
 * module exists to keep the *contract* shared (so client code and edge
 * functions agree on shape) and to power tests that don't need a network.
 *
 * In dev, when no RESEND_API_KEY is set on the server, every call routes
 * through `sendEmailStub`, which records the message in an in-memory outbox
 * and returns a deterministic id. UI code paths that "wait for the invite
 * to send" succeed without a third-party dependency.
 */

import type { IntegrationStatus } from './types';

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  id: string;
  delivered: boolean;
}

interface ResendDriver {
  send: (message: EmailMessage) => Promise<EmailResult>;
}

interface DriverConfig {
  /** Resend API key. When absent we run in stubbed mode. */
  apiKey?: string | undefined;
  /** Optional shared outbox so tests can inspect what was "sent". */
  outbox?: EmailMessage[];
  /** Override the global fetch for tests. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_FROM = 'hello@kizuna.example';

export function resendStatus(config: DriverConfig): IntegrationStatus {
  return config.apiKey ? { mode: 'live' } : { mode: 'stubbed', reason: 'RESEND_API_KEY missing' };
}

async function sendEmailLive(
  config: DriverConfig & { apiKey: string },
  message: EmailMessage,
): Promise<EmailResult> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  const body = (await response.json()) as { id?: string; message?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.message ?? `Resend send failed (${response.status})`);
  }
  return { id: body.id, delivered: true };
}

function sendEmailStub(config: DriverConfig, message: EmailMessage): EmailResult {
  config.outbox?.push(message);
  return { id: `stub_${Math.random().toString(36).slice(2, 10)}`, delivered: true };
}

function withDefaults(message: EmailMessage): EmailMessage {
  return { ...message, from: message.from || DEFAULT_FROM };
}

export function createResendDriver(config: DriverConfig = {}): ResendDriver {
  const status = resendStatus(config);
  if (status.mode === 'stubbed') {
    console.warn('[kizuna] Resend %s, falling back to in-memory outbox.', status.reason);
    return {
      send: (message) => Promise.resolve(sendEmailStub(config, withDefaults(message))),
    };
  }
  return {
    send: (message) =>
      sendEmailLive(config as DriverConfig & { apiKey: string }, withDefaults(message)),
  };
}
