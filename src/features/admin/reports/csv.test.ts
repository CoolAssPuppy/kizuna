import { describe, expect, it } from 'vitest';

import { rowsToCsv } from './csv';

describe('rowsToCsv', () => {
  it('returns just the header line when there are no rows', () => {
    expect(rowsToCsv([], ['name', 'email'])).toBe('name,email\r\n');
  });

  it('uses the keys of the first row as columns when no headers given', () => {
    const csv = rowsToCsv([
      { name: 'Paul', city: 'London' },
      { name: 'Maya', city: 'New York' },
    ]);
    expect(csv).toBe('name,city\r\nPaul,London\r\nMaya,New York\r\n');
  });

  it('quotes values containing commas, quotes, or newlines', () => {
    const csv = rowsToCsv([
      { note: 'Hello, world' },
      { note: 'She said "hi"' },
      { note: 'line1\nline2' },
    ]);
    expect(csv).toBe('note\r\n"Hello, world"\r\n"She said ""hi"""\r\n"line1\nline2"\r\n');
  });

  it('renders null and undefined as empty strings', () => {
    const csv = rowsToCsv([{ a: null, b: undefined, c: 'x' }]);
    expect(csv).toBe('a,b,c\r\n,,x\r\n');
  });

  it('coerces numbers and booleans without quoting', () => {
    const csv = rowsToCsv([{ amount: 950, paid: true }]);
    expect(csv).toBe('amount,paid\r\n950,true\r\n');
  });
});
