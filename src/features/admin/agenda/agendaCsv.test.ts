import { describe, expect, it } from 'vitest';

import { parseCsv } from './agendaCsv';

describe('parseCsv', () => {
  it('parses a basic CSV with quoted fields', () => {
    const text = 'name,note\r\nAlice,"hello, world"\r\nBob,plain\r\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Alice', 'hello, world'],
      ['Bob', 'plain'],
    ]);
  });

  it('handles doubled quotes inside quoted fields', () => {
    const text = 'q\r\n"she said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([['q'], ['she said "hi"']]);
  });

  it('preserves embedded newlines inside quoted fields', () => {
    const text = 'note\r\n"line one\nline two"\r\n';
    expect(parseCsv(text)).toEqual([['note'], ['line one\nline two']]);
  });

  it('skips fully empty rows', () => {
    const text = 'a\r\n\r\nb\r\n\r\n';
    expect(parseCsv(text)).toEqual([['a'], ['b']]);
  });

  it('accepts the final row without a trailing newline', () => {
    expect(parseCsv('x,y\r\n1,2')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});
