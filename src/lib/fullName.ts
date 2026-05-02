// Split a `full_name` into first and last on the LAST space — middle
// names ride along on `first` so the round-trip with `joinFullName`
// stays lossless.

export function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first: '', last: '' };
  const idx = trimmed.lastIndexOf(' ');
  if (idx === -1) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, idx).trim(), last: trimmed.slice(idx + 1).trim() };
}

export function joinFullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

interface EmployeeNameShape {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  legal_name?: string | null;
}

interface GuestNameShape {
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * Resolve a display name from the joined employee/guest profile pair.
 * Structured first/last columns win; otherwise we split preferred_name
 * (or legal_name) on the last space so the round-trip with
 * `joinFullName` stays lossless.
 */
export function resolveProfileName(
  employee: EmployeeNameShape | null | undefined,
  guest: GuestNameShape | null | undefined,
): { first: string; last: string; full: string } {
  let first = employee?.first_name ?? guest?.first_name ?? '';
  let last = employee?.last_name ?? guest?.last_name ?? '';
  if (!first && !last) {
    const fallback = employee?.preferred_name ?? employee?.legal_name ?? '';
    const split = splitFullName(fallback);
    first = split.first;
    last = split.last;
  }
  return { first, last, full: joinFullName(first, last) };
}
