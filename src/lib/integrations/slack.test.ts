import { describe, expect, it, vi } from 'vitest';

import { sendSlackDM, slackStatus, type SlackMessage } from './slack';

describe('slackStatus', () => {
  it('reports live with a bot token', () => {
    expect(slackStatus({ botToken: 'xoxb-123' }).mode).toBe('live');
  });
  it('reports stubbed without a bot token', () => {
    expect(slackStatus({}).mode).toBe('stubbed');
  });
});

describe('sendSlackDM', () => {
  it('records messages in the outbox when stubbed', async () => {
    const outbox: SlackMessage[] = [];
    const result = await sendSlackDM({ outbox }, { recipient: 'U1', text: 'hi' });
    expect(result.delivered).toBe(true);
    expect(outbox).toEqual([{ recipient: 'U1', text: 'hi' }]);
  });

  it('calls Slack chat.postMessage when keyed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, ts: '1234.5678' }),
    });
    const result = await sendSlackDM(
      { botToken: 'xoxb', fetchImpl },
      { recipient: 'U1', text: 'hi' },
    );
    expect(result).toEqual({ ts: '1234.5678', delivered: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when Slack returns an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
    });
    await expect(
      sendSlackDM({ botToken: 'xoxb', fetchImpl }, { recipient: 'U1', text: 'hi' }),
    ).rejects.toThrow('channel_not_found');
  });
});
