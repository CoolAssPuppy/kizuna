import { Calendar, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EventCountdown } from '@/features/events/EventCountdown';
import type { Database } from '@/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

interface Props {
  event: EventRow;
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Gradient hero that anchors the itinerary screen. Big bold name, a live
 * countdown that ticks every minute, and the event location.
 */
export function ItineraryHero({ event }: Props): JSX.Element {
  const { t } = useTranslation();
  const dateRange = `${DATE_FMT.format(new Date(event.start_date))} – ${DATE_FMT.format(new Date(event.end_date))}`;

  return (
    <section
      aria-labelledby="itinerary-hero-title"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-background to-background p-8 ring-1 ring-border"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-12 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t('itinerary.hero.eyebrow')}
          </p>
          <h1
            id="itinerary-hero-title"
            className="text-4xl font-semibold tracking-tight md:text-5xl"
          >
            {event.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar aria-hidden className="h-4 w-4" />
              {dateRange}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="h-4 w-4" />
              {event.location}
            </span>
          </div>
        </div>

        <EventCountdown startsAt={event.start_date} />
      </div>
    </section>
  );
}
