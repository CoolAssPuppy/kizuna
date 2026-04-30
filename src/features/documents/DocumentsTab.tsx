import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useDocumentsQuery } from './useDocumentsQuery';

interface DocumentsTabProps {
  eventId: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function DocumentsTab({ eventId }: DocumentsTabProps): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, error } = useDocumentsQuery({ eventId });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  if (!data || data.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t('documents.tabTitle')}</h1>
        <p className="mt-6 text-muted-foreground">{t('documents.noDocuments')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t('documents.tabTitle')}</h1>

      <div className="space-y-10">
        {data.map(({ document, acknowledgement, needsAcknowledgement }) => (
          <article key={document.id} className="space-y-3">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold">{document.title}</h2>
              <p className="text-sm text-muted-foreground">
                {t('documents.version', { version: document.version })}
                {acknowledgement
                  ? ` · ${t('documents.acknowledgedOn', {
                      date: dateFormatter.format(new Date(acknowledgement.acknowledged_at)),
                    })}`
                  : null}
              </p>
              {needsAcknowledgement ? (
                <p role="status" className="text-sm font-medium text-destructive">
                  {t('documents.versionBumped')}
                </p>
              ) : null}
            </header>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.body}</ReactMarkdown>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
