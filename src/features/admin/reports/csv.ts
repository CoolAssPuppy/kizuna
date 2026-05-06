/**
 * CSV serialization helpers.
 *
 * Hand-rolled rather than pulling in papaparse/etc because our needs are
 * small and predictable: we serialize arrays of plain objects with the
 * keys becoming columns. RFC 4180 quoting (commas, quotes, newlines) is
 * the only non-trivial thing.
 */

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function quote(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stringified = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(stringified)) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
}

export function rowsToCsv(rows: ReadonlyArray<CsvRow>, headers?: ReadonlyArray<string>): string {
  if (rows.length === 0) {
    return headers ? headers.join(',') + '\r\n' : '';
  }
  const cols = headers ?? Object.keys(rows[0]!);
  const lines: string[] = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => quote(row[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Triggers a browser download of a CSV blob. No-op when called outside a
 * browser (e.g. during SSR or tests without DOM).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
