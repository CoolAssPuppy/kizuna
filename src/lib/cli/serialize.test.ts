import { describe, expect, it } from 'vitest';

import { serializeCommand } from './serialize';

describe('serializeCommand', () => {
  it('emits the verb path with no flags when input is empty', () => {
    expect(serializeCommand({ path: ['me'], input: {} })).toBe('me');
  });

  it('appends camelCased flags as kebab-case', () => {
    expect(serializeCommand({ path: ['photos'], input: { taggedMe: true } })).toBe(
      'photos --tagged-me',
    );
  });

  it('emits --no-flag for false booleans', () => {
    expect(serializeCommand({ path: ['me', 'notifications'], input: { unread: false } })).toBe(
      'me notifications --no-unread',
    );
  });

  it('quotes values containing spaces', () => {
    const out = serializeCommand({
      path: ['admin', 'nudge'],
      input: { user: 'alice', args: ['passport please'] },
    });
    expect(out).toBe('admin nudge "passport please" @alice');
  });

  it('formats numeric flag values', () => {
    expect(serializeCommand({ path: ['me', 'itinerary'], input: { day: 2 } })).toBe(
      'me itinerary --day 2',
    );
  });

  it('expands array flags as repeats', () => {
    expect(
      serializeCommand({
        path: ['attendees'],
        input: { hobby: ['snowboarding', 'hiking'] },
      }),
    ).toBe('attendees --hobby snowboarding --hobby hiking');
  });

  it('skips undefined/null entries', () => {
    expect(
      serializeCommand({
        path: ['photos'],
        input: { mine: true, hashtag: undefined, taggedMe: null },
      }),
    ).toBe('photos --mine');
  });

  it('emits @user and :id refs', () => {
    expect(
      serializeCommand({
        path: ['attendees'],
        input: { user: 'alice', id: '01h-abc' },
      }),
    ).toBe('attendees @alice :01h-abc');
  });

  it('escapes embedded quotes', () => {
    const out = serializeCommand({
      path: ['admin', 'nudge'],
      input: { args: ['she said "hello"'] },
    });
    expect(out).toBe('admin nudge "she said \\"hello\\""');
  });
});
