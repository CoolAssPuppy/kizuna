import { describe, expect, it } from 'vitest';

import { groupMessagesForBubbles, type Message } from './bubbles';

const make = (overrides: Partial<Message>): Message => ({
  id: overrides.id ?? `m-${Math.random().toString(36).slice(2)}`,
  sender_id: overrides.sender_id ?? 'alice',
  body: overrides.body ?? 'hi',
  sent_at: overrides.sent_at ?? '2027-01-12T10:00:00Z',
  media_url: overrides.media_url ?? null,
});

describe('groupMessagesForBubbles', () => {
  it('returns an empty array for an empty input', () => {
    expect(groupMessagesForBubbles([])).toEqual([]);
  });

  it('groups consecutive messages from the same sender within the gap window', () => {
    const out = groupMessagesForBubbles([
      make({ id: '1', sender_id: 'a', sent_at: '2027-01-12T10:00:00Z' }),
      make({ id: '2', sender_id: 'a', sent_at: '2027-01-12T10:00:30Z' }),
      make({ id: '3', sender_id: 'a', sent_at: '2027-01-12T10:01:00Z' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.messages.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('starts a new bubble when sender changes', () => {
    const out = groupMessagesForBubbles([
      make({ id: '1', sender_id: 'a' }),
      make({ id: '2', sender_id: 'b' }),
      make({ id: '3', sender_id: 'a' }),
    ]);
    expect(out.map((g) => g.sender_id)).toEqual(['a', 'b', 'a']);
  });

  it('starts a new bubble when gap exceeds 5 minutes', () => {
    const out = groupMessagesForBubbles([
      make({ id: '1', sender_id: 'a', sent_at: '2027-01-12T10:00:00Z' }),
      // 6 minutes later
      make({ id: '2', sender_id: 'a', sent_at: '2027-01-12T10:06:00Z' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('exposes a stable id per group derived from the first message', () => {
    const out = groupMessagesForBubbles([
      make({ id: 'first', sender_id: 'a' }),
      make({ id: 'second', sender_id: 'a' }),
    ]);
    expect(out[0]!.id).toBe('first');
  });
});
