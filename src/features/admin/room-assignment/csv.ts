/**
 * CSV parser for hotel room blocks. Hotel sheets vary widely so we
 * accept a pragmatic subset:
 *
 *   - Header row required, with at minimum: room_number, description.
 *   - Optional headers: size_sqm | size_sqft, is_suite, capacity.
 *   - Header matching is case-insensitive and tolerant of spaces or
 *     hyphens ("Room Number" / "Room-Number" / "room_number" all map
 *     to the same key).
 *
 * Square-foot input is converted to square metres (1 sqft = 0.092903 sqm).
 * `is_suite` accepts true/false, yes/no, 1/0, or Y/N.
 *
 * Returns a `ParsedRoom[]` plus a list of soft errors so the import
 * dialog can surface bad rows without aborting the whole batch.
 */

export interface ParsedRoom {
  room_number: string;
  description: string | null;
  size_sqm: number | null;
  is_suite: boolean;
  capacity: number;
}

export interface ParseResult {
  rows: ParsedRoom[];
  errors: ReadonlyArray<{ line: number; message: string }>;
}

const HEADER_ALIASES: Record<string, string> = {
  room_number: 'room_number',
  room: 'room_number',
  number: 'room_number',
  description: 'description',
  desc: 'description',
  size_sqm: 'size_sqm',
  sqm: 'size_sqm',
  size_sqft: 'size_sqft',
  sqft: 'size_sqft',
  size: 'size_sqm',
  is_suite: 'is_suite',
  suite: 'is_suite',
  capacity: 'capacity',
  sleeps: 'capacity',
};

const SQFT_TO_SQM = 0.092903;

function normaliseHeader(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[key] ?? null;
}

function parseBoolean(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === 'y' || v === '1';
}

function splitCsvLine(line: string): string[] {
  // Lightweight CSV split: handles double-quoted fields with embedded
  // commas. Sufficient for hotel block sheets; we don't need RFC 4180
  // edge cases like embedded line breaks.
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim());
}

export function parseRoomCsv(input: string): ParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: 'Empty input' }] };
  }

  const headerCells = splitCsvLine(lines[0]!);
  const headers = headerCells.map((cell) => normaliseHeader(cell));
  const requiredIndexes = {
    room_number: headers.indexOf('room_number'),
    description: headers.indexOf('description'),
  };

  const errors: Array<{ line: number; message: string }> = [];
  if (requiredIndexes.room_number === -1) {
    errors.push({ line: 1, message: 'Missing required column: room_number' });
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: ParsedRoom[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const get = (key: string): string | undefined => {
      const idx = headers.indexOf(key);
      return idx === -1 ? undefined : cells[idx];
    };
    const roomNumber = get('room_number')?.trim();
    if (!roomNumber) {
      errors.push({ line: i + 1, message: 'Missing room_number' });
      continue;
    }
    const description = get('description')?.trim() || null;
    const isSuite = (() => {
      const raw = get('is_suite')?.trim();
      return raw ? parseBoolean(raw) : false;
    })();
    const sizeSqmRaw = get('size_sqm')?.trim();
    const sizeSqftRaw = get('size_sqft')?.trim();
    let sizeSqm: number | null = null;
    if (sizeSqmRaw) {
      const parsed = Number(sizeSqmRaw);
      if (Number.isFinite(parsed) && parsed > 0) sizeSqm = parsed;
      else errors.push({ line: i + 1, message: `Invalid size_sqm: ${sizeSqmRaw}` });
    } else if (sizeSqftRaw) {
      const parsed = Number(sizeSqftRaw);
      if (Number.isFinite(parsed) && parsed > 0)
        sizeSqm = Math.round(parsed * SQFT_TO_SQM * 10) / 10;
      else errors.push({ line: i + 1, message: `Invalid size_sqft: ${sizeSqftRaw}` });
    }
    const capacityRaw = get('capacity')?.trim();
    let capacity = isSuite ? 2 : 1;
    if (capacityRaw) {
      const parsed = Number(capacityRaw);
      if (Number.isInteger(parsed) && parsed > 0) capacity = parsed;
      else errors.push({ line: i + 1, message: `Invalid capacity: ${capacityRaw}` });
    }
    rows.push({
      room_number: roomNumber,
      description,
      size_sqm: sizeSqm,
      is_suite: isSuite,
      capacity,
    });
  }

  return { rows, errors };
}
