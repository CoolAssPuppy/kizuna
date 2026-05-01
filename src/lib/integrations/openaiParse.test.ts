import { describe, expect, it } from 'vitest';

import { nullifyEmptyStrings, stripJsonCodeFences } from './openaiParse';

describe('stripJsonCodeFences', () => {
  it('returns the input unchanged when no fence is present', () => {
    expect(stripJsonCodeFences('{"a":1}')).toBe('{"a":1}');
  });

  it('strips ```json ... ``` wrappers', () => {
    expect(stripJsonCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips bare ``` ... ``` wrappers', () => {
    expect(stripJsonCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('handles leading + trailing whitespace around the fence', () => {
    expect(stripJsonCodeFences('  \n```json\n{"a":1}\n```  \n')).toBe('{"a":1}');
  });

  it('is case-insensitive on the language tag', () => {
    expect(stripJsonCodeFences('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe('nullifyEmptyStrings', () => {
  it('coerces empty string fields to null', () => {
    expect(nullifyEmptyStrings([{ a: '', b: 'keep' }])).toEqual([{ a: null, b: 'keep' }]);
  });

  it('treats whitespace-only strings as empty', () => {
    expect(nullifyEmptyStrings([{ a: '   ', b: '\n' }])).toEqual([{ a: null, b: null }]);
  });

  it('leaves non-string values alone', () => {
    expect(
      nullifyEmptyStrings([{ a: 0, b: false, c: null, d: undefined as unknown as string }]),
    ).toEqual([{ a: 0, b: false, c: null, d: undefined }]);
  });

  it('returns a new array — does not mutate input', () => {
    const input = [{ a: '' }];
    const output = nullifyEmptyStrings(input);
    expect(output).not.toBe(input);
    expect(input[0]?.a).toBe('');
  });

  it('handles an empty input array', () => {
    expect(nullifyEmptyStrings([])).toEqual([]);
  });
});
