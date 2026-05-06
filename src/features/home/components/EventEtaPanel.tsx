import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { useMountEffect } from '@/hooks/useMountEffect';
import { cn } from '@/lib/utils';

import { dayOfEvent, diffToCountdown } from '../timeMath';

interface EventEtaPanelProps {
  slug: string;
  startDate: string;
  endDate: string | null;
  timeZone: string;
  eventName: string | null;
}

/**
 * Hero-rail countdown card. Switches between three states:
 *   - "Day N" if the event is in progress
 *   - The event name if the start date has passed but the day-of-event
 *     calc returned null (rare, mostly a UTC edge case)
 *   - A days/hours/minutes countdown otherwise
 */
export function EventEtaPanel({
  slug,
  startDate,
  endDate,
  timeZone,
  eventName,
}: EventEtaPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [now, setNow] = useState<Date>(() => new Date());

  useMountEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  });

  const countdown = diffToCountdown(new Date(startDate));
  const day = endDate ? dayOfEvent(startDate, endDate, timeZone, now) : null;
  const tipCount = Number.parseInt(t('home.terminal.dayTips.count'), 10) || 0;
  const tipKey =
    day !== null && tipCount > 0 ? `home.terminal.dayTips.t${((day - 1) % tipCount) + 1}` : null;

  const startLabel = new Date(startDate).toLocaleString('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    hourCycle: 'h23',
  });

  return (
    <div className="border border-c-rule bg-c-surface p-6">
      <TerminalEyebrow
        as="h2"
        label={`ETA · ${slug.toUpperCase()}`}
        trailing={
          <span className="text-c-accent" aria-hidden>
            ●
          </span>
        }
      />
      {day !== null ? (
        <div className="mt-4 space-y-3">
          <p
            className="text-3xl font-extralight text-c-accent"
            style={{ letterSpacing: '-0.04em' }}
          >
            {t('home.terminal.dayHeading', { day })}
          </p>
          {tipKey ? (
            <p className="text-sm text-c-muted" style={{ lineHeight: 1.5 }}>
              {t(tipKey)}
            </p>
          ) : null}
        </div>
      ) : countdown.isLive ? (
        <div
          className="mt-4 text-3xl font-extralight text-c-accent"
          style={{ letterSpacing: '-0.04em' }}
        >
          {eventName ?? t('home.terminal.nowLive')}
        </div>
      ) : (
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <EtaCell value={countdown.days} unit="d" emphasize />
          <EtaCell value={countdown.hours} unit="h" />
          <EtaCell value={countdown.minutes} unit="m" />
        </div>
      )}
      <div className="my-4 h-px bg-c-rule" />
      <dl className="space-y-1 text-[11px]">
        <EtaRow label={t('home.terminal.startLabel')} value={startLabel} highlight />
        <EtaRow label={t('home.terminal.timezoneLabel')} value={timeZone} />
      </dl>
    </div>
  );
}

function EtaCell({
  value,
  unit,
  emphasize = false,
}: {
  value: number;
  unit: string;
  emphasize?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn('font-extralight', emphasize ? 'text-c-accent' : 'text-c-fg')}
        style={{
          fontSize: emphasize ? 56 : 32,
          letterSpacing: emphasize ? '-0.04em' : undefined,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span className="text-xs text-c-dim">{unit}</span>
    </div>
  );
}

function EtaRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
      <dt className="text-c-muted">{label}</dt>
      <dd className={cn('break-words text-right', highlight ? 'text-c-accent' : 'text-c-fg')}>
        {value}
      </dd>
    </div>
  );
}
