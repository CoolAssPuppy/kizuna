import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { CsvRow } from './csv';

interface Props {
  rows: ReadonlyArray<CsvRow>;
}

const PAGE_SIZE = 25;

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  employee: 'Employee',
  guest: 'Guest',
};

/**
 * Convert a snake_case column key (e.g. "payment_status") into a
 * sentence-case display header (e.g. "Payment status"). Special-cases
 * "pct" → "%" so completion_pct renders nicely.
 */
function headerLabel(key: string): string {
  const replaced = key.replace(/_/g, ' ').replace(/\bpct\b/i, '%');
  return replaced.charAt(0).toUpperCase() + replaced.slice(1);
}

/**
 * Sentence-case a snake/space-separated enum value (e.g. "in_progress"
 * → "In progress"). Plain strings pass through with first-letter
 * capitalisation.
 */
function sentenceCase(value: string): string {
  if (!value) return '';
  const flat = value.replace(/_/g, ' ').toLowerCase();
  return flat.charAt(0).toUpperCase() + flat.slice(1);
}

function toComparable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1;
  }
  return toComparable(a).localeCompare(toComparable(b));
}

/**
 * Renders any object array as a tabular CSV-style preview with sortable
 * headers and pagination. Headers are inferred from the first row's keys
 * and rendered in sentence case. Role is rendered as a pill; status-like
 * columns get sentence-case labels.
 */
export function ReportTable({ rows }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) =>
      compareValues(a[sortKey], b[sortKey]),
    );
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (rows.length === 0) return null;

  function toggleSort(key: string): void {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
    setPage(0);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(h)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <span>{headerLabel(h)}</span>
                    <SortIcon active={sortKey === h} direction={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 align-top">
                    <Cell column={h} value={row[h]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('admin.pagination.range', {
            from: safePage * PAGE_SIZE + 1,
            to: Math.min((safePage + 1) * PAGE_SIZE, sortedRows.length),
            total: sortedRows.length,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            {t('admin.pagination.prev')}
          </Button>
          <span>
            {t('admin.pagination.pageOf', { page: safePage + 1, total: pageCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            {t('admin.pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: 'asc' | 'desc';
}): JSX.Element {
  if (!active) return <ChevronsUpDown aria-hidden className="h-3 w-3 text-muted-foreground" />;
  return direction === 'asc' ? (
    <ChevronUp aria-hidden className="h-3 w-3" />
  ) : (
    <ChevronDown aria-hidden className="h-3 w-3" />
  );
}

interface CellProps {
  column: string;
  value: unknown;
}

function Cell({ column, value }: CellProps): JSX.Element {
  if (column === 'role' && typeof value === 'string' && value.length > 0) {
    return <RolePill role={value} />;
  }
  if ((column === 'status' || column.endsWith('_status')) && typeof value === 'string') {
    return <span>{sentenceCase(value)}</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>;
  }
  if (value === null || value === undefined) return <span />;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }
  return <span>{JSON.stringify(value)}</span>;
}

function RolePill({ role }: { role: string }): JSX.Element {
  const label = ROLE_LABEL[role] ?? sentenceCase(role);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground',
      )}
    >
      {label}
    </span>
  );
}
