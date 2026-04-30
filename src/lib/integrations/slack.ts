/**
 * Slack DM wrapper.
 *
 * Spec contract: targeted DMs to specific employees, never broadcasts.
 * Rate-limited to one nudge per task per three days at the call site
 * (see notifications module).
 *
 * Live mode: POST to https://slack.com/api/chat.postMessage as the bot.
 * Stubbed mode: pushes to an in-memory outbox and returns a fake ts.
 */

import type { IntegrationStatus } from './types';

export interface SlackMessage {
  /** Slack user id (U-prefixed) or channel id. We DM users by their U id. */
  recipient: string;
  text: string;
  /** Optional Block Kit blocks. */
  blocks?: ReadonlyArray<unknown>;
}

export interface SlackResult {
  ts: string;
  delivered: boolean;
}

interface DriverConfig {
  botToken?: string | undefined;
  outbox?: SlackMessage[];
  fetchImpl?: typeof fetch;
}

export function slackStatus(config: DriverConfig): IntegrationStatus {
  return config.botToken
    ? { mode: 'live' }
    : { mode: 'stubbed', reason: 'SLACK_BOT_TOKEN missing' };
}

export async function sendSlackDM(
  config: DriverConfig,
  message: SlackMessage,
): Promise<SlackResult> {
  if (slackStatus(config).mode === 'stubbed') {
    config.outbox?.push(message);
    return {
      ts: `stub_${Math.random().toString(36).slice(2, 10)}`,
      delivered: true,
    };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.botToken ?? ''}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: message.recipient,
      text: message.text,
      blocks: message.blocks,
    }),
  });

  const body = (await response.json()) as { ok?: boolean; ts?: string; error?: string };
  if (!body.ok || !body.ts) {
    throw new Error(body.error ?? `Slack chat.postMessage failed (${response.status})`);
  }
  return { ts: body.ts, delivered: true };
}
