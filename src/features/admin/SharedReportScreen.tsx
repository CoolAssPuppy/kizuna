import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { env } from '@/lib/env';

interface SharedReport {
  report_type: string;
  rows: ReadonlyArray<Record<string, string | number | boolean | null>>;
  last_modified: string | null;
  share_expires_at: string | null;
  generated_at: string;
}

async function fetchSharedReport(token: string): Promise<SharedReport> {
  const url = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/share-report/${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.supabasePublishableKey}`,
      apikey: env.supabasePublishableKey,
    },
  });
  if (response.status === 404) throw new Error('not_found');
  if (response.status === 410) throw new Error('expired');
  if (!response.ok) throw new Error('error');
  const body: unknown = await response.json();
  return body as SharedReport;
}

export function SharedReportScreen(): JSX.Element {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const query = useQuery({
    queryKey: ['shared-report', token],
    queryFn: () => fetchSharedReport(token ?? ''),
    enabled: typeof token === 'string' && token.length > 0,
    retry: false,
  });

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('shareReport.loading')}</p>
      </main>
    );
  }

  if (query.error) {
    const message = query.error.message;
    const key =
      message === 'not_found'
        ? 'shareReport.notFound'
        : message === 'expired'
          ? 'shareReport.expired'
          : 'shareReport.error';
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p role="alert" className="max-w-md text-center text-sm text-muted-foreground">
          {t(key)}
        </p>
      </main>
    );
  }

  if (!query.data) return <main />;
  const report = query.data;
  const headers = report.rows.length > 0 ? Object.keys(report.rows[0]!) : [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {t('shareReport.eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t(`shareReport.types.${report.report_type}`, { defaultValue: report.report_type })}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t('shareReport.lastModified', {
            value: report.last_modified ? new Date(report.last_modified).toLocaleString() : '—',
          })}
        </p>
        {report.share_expires_at ? (
          <p className="text-xs text-muted-foreground">
            {t('shareReport.expires', {
              value: new Date(report.share_expires_at).toLocaleString(),
            })}
          </p>
        ) : null}
      </header>

      {report.rows.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{t('shareReport.empty')}</p>
      ) : (
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
              {report.rows.map((row, i) => (
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
      )}
    </main>
  );
}
