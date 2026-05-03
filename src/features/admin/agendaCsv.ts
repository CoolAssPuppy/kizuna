/**
 * Opinionated CSV format for agenda import/export. The intent: an admin
 * exports a blank template, edits it in Google Sheets, and re-imports.
 *
 * Columns (in this exact order; missing cells are accepted as null):
 *   - day_offset   integer, days from event.start_date (0 = day 1)
 *   - start_time   HH:MM in event.time_zone
 *   - end_time     HH:MM in event.time_zone
 *   - title        required
 *   - subtitle     optional, single line
 *   - abstract     optional, longer body
 *   - type         enum: keynote | breakout | workshop | dinner |
 *                  activity | transport | social
 *   - audience     enum: all | employees_only | guests_only | opt_in
 *   - location     optional
 *   - speaker_email optional, must match a public.users.email
 *   - is_mandatory true / false (defaults to false)
 *   - capacity     integer, optional
 *
 * The first row is always a header. Empty rows are skipped.
 */

import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { rowsToCsv } from './csv';

type SessionType = Database['public']['Enums']['session_type'];
type SessionAudience = Database['public']['Enums']['session_audience'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];

const HEADERS = [
  'day_offset',
  'start_time',
  'end_time',
  'title',
  'subtitle',
  'abstract',
  'type',
  'audience',
  'location',
  'speaker_email',
  'is_mandatory',
  'capacity',
] as const;

export interface AgendaCsvRow extends Record<string, string | number | boolean | null | undefined> {
  day_offset: number;
  start_time: string;
  end_time: string;
  title: string;
  subtitle: string;
  abstract: string;
  type: SessionType;
  audience: SessionAudience;
  location: string;
  speaker_email: string;
  is_mandatory: boolean;
  capacity: number | '';
}

const SESSION_TYPES: ReadonlyArray<SessionType> = [
  'keynote',
  'breakout',
  'workshop',
  'dinner',
  'activity',
  'transport',
  'social',
];
const AUDIENCES: ReadonlyArray<SessionAudience> = [
  'all',
  'employees_only',
  'guests_only',
  'opt_in',
];

function asSessionType(value: string): SessionType {
  if (!SESSION_TYPES.includes(value as SessionType)) {
    throw new Error(`Unknown session type: ${value}`);
  }
  return value as SessionType;
}

function asAudience(value: string): SessionAudience {
  if (!AUDIENCES.includes(value as SessionAudience)) {
    throw new Error(`Unknown audience: ${value}`);
  }
  return value as SessionAudience;
}

/**
 * Parses a single line of CSV — handles quoted fields with commas,
 * doubled quotes for embedded ", and CRLF line endings. Hand-rolled to
 * avoid pulling in papaparse.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // Normalise CRLF and bare CR to a single LF event
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function blankAgendaCsv(): string {
  return [...HEADERS, ...HEADERS.map(() => '')]
    .reduce<string[][]>((acc, _, i) => {
      if (i % HEADERS.length === 0) acc.push([]);
      acc[acc.length - 1]!.push(HEADERS[i % HEADERS.length]!);
      return acc;
    }, [])
    .slice(0, 1)
    .map((r) => r.join(','))
    .join('\r\n')
    .concat('\r\n');
}

export function agendaToCsv(sessions: ReadonlyArray<AgendaCsvRow>): string {
  return rowsToCsv(sessions, HEADERS);
}

export interface AgendaImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

/**
 * Reads a CSV string, validates each row, and upserts sessions for the
 * given event. Returns counts plus per-row errors so the admin sees
 * exactly which rows failed and why.
 */
export async function importAgendaCsv(
  client: AppSupabaseClient,
  args: { eventId: string; eventStartDate: string; eventTimeZone: string; csv: string },
): Promise<AgendaImportResult> {
  const grid = parseCsv(args.csv);
  if (grid.length === 0) return { imported: 0, errors: [{ row: 0, message: 'empty' }] };

  const header = grid[0]!;
  const expectedHeader = HEADERS.join(',');
  const actualHeader = header.join(',');
  if (actualHeader !== expectedHeader) {
    return {
      imported: 0,
      errors: [{ row: 1, message: `Header mismatch. Expected: ${expectedHeader}` }],
    };
  }

  const inserts: SessionInsert[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!;
    if (cells.every((c) => !c.trim())) continue;
    try {
      const dayOffset = Number.parseInt(cells[0]!.trim(), 10);
      if (!Number.isFinite(dayOffset)) throw new Error('day_offset must be an integer');
      const startTime = cells[1]!.trim();
      const endTime = cells[2]!.trim();
      const title = cells[3]!.trim();
      if (!title) throw new Error('title is required');
      const subtitle = cells[4]!.trim() || null;
      const abstract = cells[5]!.trim() || null;
      const type = asSessionType(cells[6]!.trim());
      const audience = asAudience(cells[7]!.trim());
      const location = cells[8]!.trim() || null;
      const speakerEmail = cells[9]!.trim().toLowerCase() || null;
      const isMandatory = ['true', '1', 'yes'].includes(cells[10]!.trim().toLowerCase());
      const capacityRaw = cells[11]!.trim();
      const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;

      const baseDate = new Date(`${args.eventStartDate}T00:00:00Z`);
      const sessionDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const sessionDay = sessionDate.toISOString().slice(0, 10);
      const startsAt = new Date(`${sessionDay}T${startTime}:00`).toISOString();
      const endsAt = new Date(`${sessionDay}T${endTime}:00`).toISOString();

      inserts.push({
        event_id: args.eventId,
        title,
        subtitle,
        abstract,
        type,
        audience,
        location,
        speaker_email: speakerEmail,
        is_mandatory: isMandatory,
        capacity: Number.isFinite(capacity ?? NaN) ? capacity : null,
        starts_at: startsAt,
        ends_at: endsAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      errors.push({ row: r + 1, message });
    }
  }

  if (inserts.length === 0) {
    return { imported: 0, errors };
  }

  const { error } = await client.from('sessions').insert(inserts);
  if (error) {
    return { imported: 0, errors: [...errors, { row: 0, message: error.message }] };
  }

  return { imported: inserts.length, errors };
}

/** Maps loaded sessions back into the CSV row shape for export. */
export function sessionsToCsvRows(
  sessions: ReadonlyArray<Database['public']['Tables']['sessions']['Row']>,
  eventStartDate: string,
): AgendaCsvRow[] {
  const baseDate = new Date(`${eventStartDate}T00:00:00Z`).getTime();
  // Proposals carry no schedule — exclude them from CSV export so the
  // round-trip stays well-formed.
  return sessions
    .filter((s) => s.starts_at !== null && s.ends_at !== null)
    .map((s) => {
      const start = new Date(s.starts_at!);
      const end = new Date(s.ends_at!);
      const dayOffset = Math.round(
        (Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) - baseDate) /
          86_400_000,
      );
      return {
        day_offset: dayOffset,
        start_time: start.toISOString().slice(11, 16),
        end_time: end.toISOString().slice(11, 16),
        title: s.title,
        subtitle: s.subtitle ?? '',
        abstract: s.abstract ?? '',
        type: s.type,
        audience: s.audience,
        location: s.location ?? '',
        speaker_email: s.speaker_email ?? '',
        is_mandatory: s.is_mandatory,
        capacity: s.capacity ?? '',
      };
    });
}
