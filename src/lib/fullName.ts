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
