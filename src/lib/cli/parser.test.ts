import { describe, expect, it } from 'vitest';

import { CommandParseError, parseCommand, tokenize } from './parser';

describe('tokenize', () => {
  it('splits simple verb-noun input', () => {
    expect(tokenize('me itinerary')).toEqual(['me', 'itinerary']);
  });

  it('keeps double-quoted strings as one token', () => {
    expect(tokenize('admin nudge @alice "passport please"')).toEqual([
      'admin',
      'nudge',
      '@alice',
      'passport please',
    ]);
  });

  it('keeps single-quoted strings as one token', () => {
    expect(tokenize("attendees --hobby 'mountain biking'")).toEqual([
      'attendees',
      '--hobby',
      'mountain biking',
    ]);
  });

  it('collapses runs of whitespace', () => {
    expect(tokenize('  me   sessions   ')).toEqual(['me', 'sessions']);
  });

  it('throws on an unclosed quote', () => {
    expect(() => tokenize('admin nudge "missing close')).toThrow(CommandParseError);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('parseCommand', () => {
  it('returns empty when input is whitespace only', () => {
    expect(parseCommand('   ')).toEqual({ words: [], refs: {}, flags: {} });
  });

  it('lowercases verb words', () => {
    expect(parseCommand('ME ITINERARY').words).toEqual(['me', 'itinerary']);
  });

  it('keeps quoted positional args case-sensitive', () => {
    const parsed = parseCommand('admin nudge @Alice "Passport Please"');
    expect(parsed.refs.user).toBe('Alice');
    expect(parsed.words).toEqual(['admin', 'nudge', 'passport please']);
  });

  it('parses --key=value flags', () => {
    expect(parseCommand('me itinerary --day=2').flags).toEqual({ day: 2 });
  });

  it('parses --key value flags', () => {
    expect(parseCommand('me itinerary --day 2').flags).toEqual({ day: 2 });
  });

  it('coerces booleans for bare --flag', () => {
    expect(parseCommand('sessions --mandatory').flags).toEqual({ mandatory: true });
  });

  it('coerces --no-flag to false', () => {
    expect(parseCommand('me notifications --no-unread').flags).toEqual({ unread: false });
  });

  it('camelCases kebab-cased flag names', () => {
    expect(parseCommand('photos --tagged-me').flags).toEqual({ taggedMe: true });
  });

  it('preserves @user and :id refs', () => {
    expect(parseCommand('attendees @alice')).toEqual({
      words: ['attendees'],
      refs: { user: 'alice' },
      flags: {},
    });
    expect(parseCommand('sessions :01h-abc')).toEqual({
      words: ['sessions'],
      refs: { id: '01h-abc' },
      flags: {},
    });
  });

  it('handles a flag whose value would otherwise look like a flag', () => {
    // Heuristic: if the next token starts with `--`, the flag is boolean.
    const parsed = parseCommand('attendees --hobby --team platform');
    expect(parsed.flags).toEqual({ hobby: true, team: 'platform' });
  });

  it('handles a flag whose value looks like a number', () => {
    expect(parseCommand('me notifications --limit 25').flags).toEqual({ limit: 25 });
  });

  it('handles a flag whose value is "false"', () => {
    expect(parseCommand('photos --mine=false').flags).toEqual({ mine: false });
  });

  it('drops empty word tokens', () => {
    expect(parseCommand('me  itinerary').words).toEqual(['me', 'itinerary']);
  });
});
