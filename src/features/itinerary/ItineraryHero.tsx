import { Calendar, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isLive: boolean;
}

function diffToCountdown(target: Date): Countdown {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, isLive: true };
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes / 60) % 24),
    minutes: totalMinutes % 60,
    isLive: false,
  };
}

/**
 * Gradient hero that anchors the itinerary screen. Big bold name, a live
 * countdown that ticks every minute, and the event location.
 */
export function ItineraryHero({ event }: Props): JSX.Element {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState<Countdown>(() =>
    diffToCountdown(new Date(event.start_date)),
  );

  useEffect(() => {
    const tick = (): void => setCountdown(diffToCountdown(new Date(event.start_date)));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [event.start_date]);

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

        <Countdown countdown={countdown} />
      </div>
    </section>
  );
}

function Countdown({ countdown }: { countdown: Countdown }): JSX.Element {
  const { t } = useTranslation();

  if (countdown.isLive) {
    return (
      <div
        className="inline-flex animate-pulse items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        role="status"
      >
        <span className="h-2 w-2 rounded-full bg-primary-foreground" aria-hidden />
        {t('itinerary.hero.live')}
      </div>
    );
  }

  return (
    <dl
      className="grid grid-cols-3 gap-2 rounded-xl border bg-card/60 px-4 py-3 text-center backdrop-blur"
      aria-label={t('itinerary.hero.countdownLabel')}
    >
      <Tile value={countdown.days} label={t('itinerary.hero.days')} />
      <Tile value={countdown.hours} label={t('itinerary.hero.hours')} />
      <Tile value={countdown.minutes} label={t('itinerary.hero.minutes')} />
    </dl>
  );
}

function Tile({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div className="flex min-w-14 flex-col items-center">
      <dt className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toString().padStart(2, '0')}
      </dt>
      <dd className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dd>
    </div>
  );
}
