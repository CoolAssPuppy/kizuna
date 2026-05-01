import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

interface Props {
  /** ISO date or full date string. Component re-renders every minute. */
  startsAt: string;
  /** Optional smaller variant for compact placements like the home header. */
  size?: 'default' | 'sm';
  /** Stretch to fill its container instead of sitting at content width. */
  fullWidth?: boolean;
}

/**
 * Live event-countdown clock. Ticks every minute. When the start time
 * passes it flips to a pulsing "Live" pill. Single source of truth for
 * countdown UI across the itinerary hero and the home header.
 */
export function EventCountdown({
  startsAt,
  size = 'default',
  fullWidth = false,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState<Countdown>(() => diffToCountdown(new Date(startsAt)));

  useEffect(() => {
    setCountdown(diffToCountdown(new Date(startsAt)));
    const id = window.setInterval(() => setCountdown(diffToCountdown(new Date(startsAt))), 60_000);
    return () => window.clearInterval(id);
  }, [startsAt]);

  if (countdown.isLive) {
    return (
      <div
        className={
          fullWidth
            ? 'flex animate-pulse items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground'
            : 'inline-flex animate-pulse items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground'
        }
        role="status"
      >
        <span className="h-2 w-2 rounded-full bg-primary-foreground" aria-hidden />
        {t('itinerary.hero.live')}
      </div>
    );
  }

  const baseClasses =
    size === 'sm'
      ? 'grid grid-cols-3 gap-1.5 rounded-lg border bg-card/60 px-3 py-2 text-center backdrop-blur'
      : 'grid grid-cols-3 gap-2 rounded-xl border bg-card/60 px-4 py-3 text-center backdrop-blur';
  return (
    <dl
      className={fullWidth ? `${baseClasses} w-full` : baseClasses}
      aria-label={t('itinerary.hero.countdownLabel')}
    >
      <Tile size={size} value={countdown.days} label={t('itinerary.hero.days')} />
      <Tile size={size} value={countdown.hours} label={t('itinerary.hero.hours')} />
      <Tile size={size} value={countdown.minutes} label={t('itinerary.hero.minutes')} />
    </dl>
  );
}

function Tile({
  size,
  value,
  label,
}: {
  size: 'default' | 'sm';
  value: number;
  label: string;
}): JSX.Element {
  return (
    <div
      className={
        size === 'sm'
          ? 'flex min-w-10 flex-col items-center'
          : 'flex min-w-14 flex-col items-center'
      }
    >
      <dt
        className={
          size === 'sm'
            ? 'text-base font-semibold tabular-nums tracking-tight'
            : 'text-2xl font-semibold tabular-nums tracking-tight'
        }
      >
        {value.toString().padStart(2, '0')}
      </dt>
      <dd className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dd>
    </div>
  );
}
