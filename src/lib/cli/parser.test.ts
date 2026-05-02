import { describe, expect, it } from 'vitest';

import { parseCommand, tokenize } from './parser';

describe('tokenize', () => {
  it('keeps quoted strings together', () => {
    expect(tokenize('admin nudge @alice "passport please"')).toEqual([
      'admin',
      'nudge',
      '@alice',
      'passport please',
    ]);
  });
});

describe('parseCommand', () => {
  it('parses words, refs, ids, and mixed flags', () => {
    expect(parseCommand('me itinerary :abc --day 2 --format=md --mandatory --no-unread')).toEqual({
      words: ['me', 'itinerary'],
      refs: { id: 'abc' },
      flags: { day: 2, format: 'md', mandatory: true, unread: false },
    });
  });

  it('parses person refs', () => {
    expect(parseCommand('attendees @alice --hobby snowboarding')).toEqual({
      words: ['attendees'],
      refs: { user: 'alice' },
      flags: { hobby: 'snowboarding' },
    });
  });
});
