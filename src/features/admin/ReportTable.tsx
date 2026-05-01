import type { CsvRow } from './csv';

interface Props {
  rows: ReadonlyArray<CsvRow>;
}

/**
 * Renders any object array as a tabular CSV-style preview. Headers are
 * inferred from the first row's keys. Used by the admin dashboard and
 * by the public shared-report view; both render the same shape and
 * benefit from picking up styling tweaks in one place.
 */
export function ReportTable({ rows }: Props): JSX.Element | null {
  if (rows.length === 0) return null;
  const headers = Object.keys(rows[0]!);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2 align-top">
                  {String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
