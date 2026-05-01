import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { getSupabaseClient } from '@/lib/supabase';

import { fetchOpenConflicts, resolveConflict } from './conflicts';
import type { DataConflictRow } from './conflicts';

export function ConflictsPanel(): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'conflicts'],
    queryFn: () => fetchOpenConflicts(getSupabaseClient()),
  });

  const mutation = useMutation({
    mutationFn: ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: 'accepted_kizuna' | 'accepted_external';
    }) => resolveConflict(getSupabaseClient(), conflictId, resolution, null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'conflicts'] });
    },
  });

  if (isLoading) {
    return (
      <p className="py-8 text-sm text-muted-foreground" aria-busy="true">
        {t('auth.checkingSession')}
      </p>
    );
  }
  if (!data || data.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.conflicts.noConflicts')}</p>;
  }

  return (
    <ul className="space-y-3">
      {data.map((conflict) => (
        <ConflictRow
          key={conflict.id}
          conflict={conflict}
          onResolve={(resolution) => mutation.mutate({ conflictId: conflict.id, resolution })}
        />
      ))}
    </ul>
  );
}

interface RowProps {
  conflict: DataConflictRow;
  onResolve: (resolution: 'accepted_kizuna' | 'accepted_external') => void;
}

function ConflictRow({ conflict, onResolve }: RowProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <li className="space-y-3 rounded-md border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex flex-row items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {conflict.table_name} · {conflict.field_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin.conflicts.external')}: {conflict.external_source} ·{' '}
            {t('admin.conflicts.detectedAt')}:{' '}
            {mediumDateTimeFormatter.format(new Date(conflict.detected_at))}
          </p>
        </div>
      </header>
      <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md bg-muted px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('admin.conflicts.kizunaValue')}
          </dt>
          <dd className="mt-1 font-mono text-xs">{conflict.kizuna_value ?? '—'}</dd>
        </div>
        <div className="rounded-md bg-muted px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">
            {t('admin.conflicts.externalValue')}
          </dt>
          <dd className="mt-1 font-mono text-xs">{conflict.external_value ?? '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-row gap-2">
        <Button variant="outline" size="sm" onClick={() => onResolve('accepted_kizuna')}>
          {t('admin.conflicts.acceptKizuna')}
        </Button>
        <Button size="sm" onClick={() => onResolve('accepted_external')}>
          {t('admin.conflicts.acceptExternal')}
        </Button>
      </div>
    </li>
  );
}
