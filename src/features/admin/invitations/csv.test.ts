import { describe, expect, it } from 'vitest';

import { parseInvitationsCsv } from './csv';

describe('parseInvitationsCsv', () => {
  it('parses a clean three-column file', () => {
    const text = [
      'email,first_name,last_name',
      'taylor@supabase.io,Taylor,Reed',
      'avery@supabase.io,Avery,Lin',
    ].join('\n');
    const result = parseInvitationsCsv(text);
    expect(result.errors).toEqual([]);
    expect(result.rejectedInvalid).toBe(0);
    expect(result.drafts).toEqual([
      { email: 'taylor@supabase.io', first_name: 'Taylor', last_name: 'Reed' },
      { email: 'avery@supabase.io', first_name: 'Avery', last_name: 'Lin' },
    ]);
  });

  it('tolerates an arbitrary header column order', () => {
    const text = ['last_name,email,first_name', 'Reed,taylor@supabase.io,Taylor'].join('\n');
    const result = parseInvitationsCsv(text);
    expect(result.drafts).toEqual([
      { email: 'taylor@supabase.io', first_name: 'Taylor', last_name: 'Reed' },
    ]);
  });

  it('rejects rows missing any required field', () => {
    const text = [
      'email,first_name,last_name',
      'taylor@supabase.io,Taylor,Reed',
      ',Avery,Lin',
      'avery@supabase.io,,Lin',
    ].join('\n');
    const result = parseInvitationsCsv(text);
    expect(result.drafts).toHaveLength(1);
    expect(result.rejectedInvalid).toBe(2);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects when the header row is missing a required column', () => {
    const text = ['email,last_name', 'taylor@supabase.io,Reed'].join('\n');
    const result = parseInvitationsCsv(text);
    expect(result.drafts).toEqual([]);
    expect(result.errors[0]?.message).toContain('first_name');
  });

  it('handles quoted fields with commas inside', () => {
    const text = ['email,first_name,last_name', '"taylor@supabase.io","Taylor","Reed, Esq."'].join(
      '\n',
    );
    const result = parseInvitationsCsv(text);
    expect(result.drafts).toEqual([
      { email: 'taylor@supabase.io', first_name: 'Taylor', last_name: 'Reed, Esq.' },
    ]);
  });

  it('returns an error for empty input', () => {
    expect(parseInvitationsCsv('').errors[0]?.message).toBe('csv_empty');
  });

  it('handles CRLF line endings', () => {
    const text = 'email,first_name,last_name\r\ntaylor@supabase.io,Taylor,Reed\r\n';
    expect(parseInvitationsCsv(text).drafts).toHaveLength(1);
  });
});
