import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { Database } from '@/types/database.types';

import { CheckinCard } from './CheckinCard';
import { GuestSyncToggle } from './GuestSyncToggle';
import { ImportItineraryDialog } from './ImportItineraryDialog';
import { ItineraryHero } from './ItineraryHero';
import { ItineraryTimeline } from './ItineraryTimeline';
import { NowNextCard } from './NowNextCard';
import { useItinerary } from './useItinerary';

type EventRow = Database['public']['Tables']['events']['Row'];

interface Props {
  event: EventRow;
}

const localTimeZone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

export function ItineraryScreen({ event }: Props): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, error, invalidate } = useItinerary({ eventId: event.id });
  const [importOpen, setImportOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('itinerary.loading')}</p>
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

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-8 py-10">
      <ItineraryHero event={event} />

      <CheckinCard eventId={event.id} />

      <GuestSyncToggle onToggle={invalidate} />

      <NowNextCard items={data ?? []} />

      <section className="space-y-4">
        <header className="flex flex-row items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('itinerary.timelineTitle')}</h2>
          <Button onClick={() => setImportOpen(true)} className="gap-2">
            <Plus aria-hidden className="h-4 w-4" />
            {t('itinerary.import.cta')}
          </Button>
        </header>

        <ItineraryTimeline
          items={data ?? []}
          timeZone={localTimeZone}
          eventStart={event.start_date}
          eventEnd={event.end_date}
        />
      </section>

      <ImportItineraryDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventTimezone={event.time_zone}
        onImported={invalidate}
      />
    </main>
  );
}
