import { describe, expect, it } from 'vitest';

import { parseHashtags, parseMentions, captionTokens } from './captionParser';

describe('parseHashtags', () => {
  it('returns empty array for empty input', () => {
    expect(parseHashtags('')).toEqual([]);
    expect(parseHashtags(null)).toEqual([]);
    expect(parseHashtags(undefined)).toEqual([]);
  });

  it('extracts simple hashtags', () => {
    expect(parseHashtags('a #banff and #snow trip')).toEqual(['banff', 'snow']);
  });

  it('lowercases and dedupes', () => {
    expect(parseHashtags('#Banff #banff #BANFF')).toEqual(['banff']);
  });

  it('respects 1-64 char range', () => {
    const long = '#' + 'a'.repeat(70);
    expect(parseHashtags(long)).toEqual([]);
    expect(parseHashtags('#' + 'a'.repeat(64))).toEqual(['a'.repeat(64)]);
  });

  it('matches the server trigger regex (stops at non [A-Za-z0-9_])', () => {
    // Mirrors sync_event_photo_hashtags(): #not-valid yields "not",
    // #also.bad yields "also", #café yields "caf". The client preview
    // must agree with what the server eventually parses.
    expect(parseHashtags('#valid #not-valid #also.bad')).toEqual(['valid', 'not', 'also']);
    expect(parseHashtags('#café')).toEqual(['caf']);
  });

  it('matches the trigger regex shape (alphanumeric + underscore only)', () => {
    expect(parseHashtags('#snow_2026')).toEqual(['snow_2026']);
  });
});

describe('parseMentions', () => {
  it('extracts emails after @', () => {
    expect(parseMentions('hi @alice@example.com great pic')).toEqual(['alice@example.com']);
  });

  it('returns dedup, original case', () => {
    expect(parseMentions('@bob@x.com and @bob@x.com again')).toEqual(['bob@x.com']);
  });

  it('handles bare @ without email-shaped match', () => {
    expect(parseMentions('@ and then @notanemail')).toEqual([]);
  });
});

describe('captionTokens', () => {
  it('splits caption into typed tokens preserving order', () => {
    expect(captionTokens('Sunset over #banff with @ada@x.com — beautiful')).toEqual([
      { kind: 'text', value: 'Sunset over ' },
      { kind: 'hashtag', value: 'banff' },
      { kind: 'text', value: ' with ' },
      { kind: 'mention', value: 'ada@x.com' },
      { kind: 'text', value: ' — beautiful' },
    ]);
  });

  it('keeps trailing text', () => {
    expect(captionTokens('hello world')).toEqual([{ kind: 'text', value: 'hello world' }]);
  });

  it('handles consecutive tokens', () => {
    expect(captionTokens('#a #b #c')).toEqual([
      { kind: 'hashtag', value: 'a' },
      { kind: 'text', value: ' ' },
      { kind: 'hashtag', value: 'b' },
      { kind: 'text', value: ' ' },
      { kind: 'hashtag', value: 'c' },
    ]);
  });
});
