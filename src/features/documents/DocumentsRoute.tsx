import { useTranslation } from 'react-i18next';

import { useActiveEvent } from '@/features/events/useActiveEvent';

import { DocumentsTab } from './DocumentsTab';

export function DocumentsRoute(): JSX.Element {
  const { t } = useTranslation();
  const { data: event, isLoading, error } = useActiveEvent();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {error?.message ?? t('documents.noDocuments')}
        </p>
      </main>
    );
  }

  return <DocumentsTab eventId={event.id} />;
}
