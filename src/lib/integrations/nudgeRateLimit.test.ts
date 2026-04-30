import { describe, expect, it } from 'vitest';

import { canSendNudge, nextEligibleAt } from './nudgeRateLimit';

const REFERENCE = new Date('2026-05-01T12:00:00Z');

describe('canSendNudge', () => {
  it('allows the first nudge when nothing has been sent', () => {
    expect(canSendNudge({ lastNudgeAtIso: null, now: REFERENCE })).toBe(true);
  });

  it('blocks a nudge sent inside the 3-day window', () => {
    expect(
      canSendNudge({
        lastNudgeAtIso: '2026-04-30T12:00:00Z', // 1 day ago
        now: REFERENCE,
      }),
    ).toBe(false);
  });

  it('allows a nudge once the window has elapsed', () => {
    expect(
      canSendNudge({
        lastNudgeAtIso: '2026-04-28T11:59:59Z', // > 3 days ago
        now: REFERENCE,
      }),
    ).toBe(true);
  });

  it('treats invalid timestamps as "never sent"', () => {
    expect(canSendNudge({ lastNudgeAtIso: 'not-a-date', now: REFERENCE })).toBe(true);
  });
});

describe('nextEligibleAt', () => {
  it('returns null when there is no prior nudge', () => {
    expect(nextEligibleAt(null)).toBeNull();
  });

  it('returns three days after the last nudge', () => {
    const next = nextEligibleAt('2026-04-30T12:00:00Z');
    expect(next?.toISOString()).toBe('2026-05-03T12:00:00.000Z');
  });
});
