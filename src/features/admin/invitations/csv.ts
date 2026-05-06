import type { InvitationDraft } from './api';

/**
 * Parses the bulk-import CSV used by the InviteAttendeeDialog.
 *
 * Required header row, exactly: `email,first_name,last_name`. Whitespace
 * around column names is tolerated; case is not (we anchor on the exact
 * tokens the spec mandates so a stray "Email" column can't quietly map
 * to a different field).
 *
 * Rows with missing required fields are returned in `rejectedInvalid`
 * so the dialog can render "X rejected" feedback. The caller dedupes
 * against existing rows via addInvitations(); we don't filter dupes
 * here because parsing is cheap and a single error model in the api
 * layer is easier to reason about.
 */

export interface CsvParseResult {
  drafts: InvitationDraft[];
  rejectedInvalid: number;
  /** Detailed reason rows for the first few rejections, for the toast. */
  errors: Array<{ row: number; message: string }>;
}

const REQUIRED_HEADERS = ['email', 'first_name', 'last_name'] as const;

function splitLine(line: string): string[] {
  // Bare-bones CSV: comma-separated, double quotes around values that
  // contain commas. The CSV format the spec demands is flat enough that
  // this two-state machine covers it without pulling in a parser dep.
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    if (ch === '"' && cur.length === 0) {
      inQuote = true;
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseInvitationsCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      drafts: [],
      rejectedInvalid: 0,
      errors: [{ row: 0, message: 'csv_empty' }],
    };
  }
  const firstLine = lines[0] ?? '';
  const headers = splitLine(firstLine).map((h) => h.toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      return {
        drafts: [],
        rejectedInvalid: 0,
        errors: [{ row: 1, message: `csv_missing_header:${required}` }],
      };
    }
  }

  const idxEmail = headers.indexOf('email');
  const idxFirst = headers.indexOf('first_name');
  const idxLast = headers.indexOf('last_name');

  const drafts: InvitationDraft[] = [];
  const errors: CsvParseResult['errors'] = [];
  let rejectedInvalid = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const cols = splitLine(line);
    const email = cols[idxEmail] ?? '';
    const first = cols[idxFirst] ?? '';
    const last = cols[idxLast] ?? '';
    if (!email || !first || !last) {
      rejectedInvalid += 1;
      if (errors.length < 5) errors.push({ row: i + 1, message: 'csv_missing_field' });
      continue;
    }
    drafts.push({ email, first_name: first, last_name: last });
  }
  return { drafts, rejectedInvalid, errors };
}
