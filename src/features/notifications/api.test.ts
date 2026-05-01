import { describe, expect, it } from 'vitest';

import { unreadCount, type NotificationRow } from './api';

function makeRow(overrides?: Partial<NotificationRow>): NotificationRow {
  return {
    id: 'n1',
    user_id: 'u1',
    event_id: null,
    channel: 'in_app',
    notification_type: 'announcement',
    task_id: null,
    subject: 'Hello',
    body: 'Body',
    sent_at: '2026-04-30T00:00:00Z',
    delivered: true,
    read_at: null,
    sent_by: null,
    ...overrides,
  };
}

describe('unreadCount', () => {
  it('returns 0 when every row has been read', () => {
    expect(
      unreadCount([
        makeRow({ id: 'a', read_at: '2026-04-30T01:00:00Z' }),
        makeRow({ id: 'b', read_at: '2026-04-30T02:00:00Z' }),
      ]),
    ).toBe(0);
  });

  it('counts only unread rows', () => {
    expect(
      unreadCount([
        makeRow({ id: 'a', read_at: null }),
        makeRow({ id: 'b', read_at: '2026-04-30T01:00:00Z' }),
        makeRow({ id: 'c', read_at: null }),
      ]),
    ).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(unreadCount([])).toBe(0);
  });
});
