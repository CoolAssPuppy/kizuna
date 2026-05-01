import { Plane, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';

import {
  jetLagDirection,
  jetLagSeverity,
  offsetHoursBetween,
  type JetLagDirection,
  type JetLagSeverity,
} from './jetLag';

interface Props {
  /** Event timezone (IANA name, e.g. America/Edmonton). */
  eventTimeZone: string;
}

const TIPS_BY_DIRECTION: Record<Exclude<JetLagDirection, 'none'>, string[]> = {
  east: [
    'home.jetLag.tips.eastSleepEarly',
    'home.jetLag.tips.eastMorningLight',
    'home.jetLag.tips.eastAvoidEveningCaffeine',
    'home.jetLag.tips.melatoninLowDose',
    'home.jetLag.tips.hydrate',
    'home.jetLag.tips.mealAnchor',
    'home.jetLag.tips.exerciseDaylight',
  ],
  west: [
    'home.jetLag.tips.westSleepLate',
    'home.jetLag.tips.westEveningLight',
    'home.jetLag.tips.westMorningCaffeineOk',
    'home.jetLag.tips.melatoninWest',
    'home.jetLag.tips.hydrate',
    'home.jetLag.tips.mealAnchor',
    'home.jetLag.tips.exerciseDaylight',
  ],
};

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function JetLagFighter({ eventTimeZone }: Props): JSX.Element | null {
  const { t } = useTranslation();
  // The browser tz is the right signal: it accounts for current location,
  // DST, and any in-flight travel without round-tripping through the DB.
  const offset = useMemo(
    () => offsetHoursBetween(browserTimeZone(), eventTimeZone),
    [eventTimeZone],
  );
  const direction = jetLagDirection(offset);
  if (direction === 'none') return null;

  const severity = jetLagSeverity(offset);
  const tipKeys = TIPS_BY_DIRECTION[direction];
  const Icon = direction === 'east' ? Sun : Plane;

  return (
    <CardShell
      title={t('home.jetLag.title')}
      description={t('home.jetLag.subtitle', {
        offset: Math.abs(Math.round(offset)),
        direction: t(`home.jetLag.directions.${direction}`),
        severity: t(`home.jetLag.severities.${severity}`),
      })}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon aria-hidden className="h-4 w-4" />
          <span>{t('home.jetLag.intro')}</span>
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {tipKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t('home.jetLag.disclaimer')}</p>
      </div>
    </CardShell>
  );
}

export type { JetLagDirection, JetLagSeverity };
