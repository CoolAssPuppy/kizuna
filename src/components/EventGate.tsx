import { useTranslation } from 'react-i18next';

import { useActiveEvent } from '@/features/events/useActiveEvent';
import type { Database } from '@/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

interface Props {
  /** Renders the wrapped screen only when the active event is loaded. */
  children: (event: EventRow) => JSX.Element;
}

/**
 * Gates a screen on the active event. Surfaces a consistent loading
 * spinner and error banner across every event-scoped route. Routes that
 * need the event row (itinerary, documents, consent, registration) wrap
 * their child screen in EventGate so the loading + error contract is in
 * one place.
 */
export function EventGate({ children }: Props): JSX.Element {
  const { t } = useTranslation();
  const { data: event, isLoading, error } = useActiveEvent();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('app.loadingEvent')}</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {error?.message ?? t('app.noEvent')}
        </p>
      </main>
    );
  }

  return children(event);
}
