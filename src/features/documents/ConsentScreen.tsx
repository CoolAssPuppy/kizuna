import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { ConsentGate } from './ConsentGate';
import { useAcknowledgeMutation, useDocumentsQuery } from './useDocumentsQuery';

interface ConsentScreenProps {
  eventId: string;
  /** Where to send the user once every required document is acknowledged. */
  redirectTo?: string;
}

export function ConsentScreen({ eventId, redirectTo = '/' }: ConsentScreenProps): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, error } = useDocumentsQuery({ eventId });
  const { mutateAsync } = useAcknowledgeMutation({ eventId });

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  const next = data?.find((d) => d.needsAcknowledgement);

  if (!next) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('documents.consentTitle')}</h1>
        </header>

        <ConsentGate
          document={next.document}
          onAcknowledge={async ({ scrolledToBottom, explicitCheckbox, deviceType }) => {
            await mutateAsync({
              documentId: next.document.id,
              documentKey: next.document.document_key,
              documentVersion: next.document.version,
              scrolledToBottom,
              explicitCheckbox,
              deviceType,
            });
          }}
        />
      </div>
    </main>
  );
}
