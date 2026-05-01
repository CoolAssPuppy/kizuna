import { Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';

import {
  jetLagDirection,
  jetLagSeverity,
  offsetHoursBetween,
  type JetLagDirection,
  type JetLagSeverity,
} from './jetLag';
import { pickJetLagTip } from './jetLagTips';

interface Props {
  /** Event timezone (IANA name, e.g. America/Edmonton). */
  eventTimeZone: string;
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Single-tip jet-lag card. Picks one tip from the curated pool on
 * mount; "Show another" rotates with a fresh seed so users can browse
 * advice without leaving the home screen. The previous list-of-seven
 * layout was overwhelming and quickly stale on re-visits.
 */
export function JetLagFighter({ eventTimeZone }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const offset = useMemo(
    () => offsetHoursBetween(browserTimeZone(), eventTimeZone),
    [eventTimeZone],
  );
  const direction = jetLagDirection(offset);
  if (direction === 'none') return null;

  const severity = jetLagSeverity(offset);
  return <JetLagBody direction={direction} offset={offset} severity={severity} t={t} />;
}

interface BodyProps {
  direction: Exclude<JetLagDirection, 'none'>;
  offset: number;
  severity: JetLagSeverity;
  t: ReturnType<typeof useTranslation>['t'];
}

function JetLagBody({ direction, offset, severity, t }: BodyProps): JSX.Element {
  const [seed, setSeed] = useState<number>(() => Date.now());
  const tip = pickJetLagTip(direction, seed);

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
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 text-amber-500" />
          <p className="text-sm leading-relaxed">{tip?.text ?? t('home.jetLag.intro')}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t('home.jetLag.disclaimer')}</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSeed(Date.now() + Math.random())}
          >
            {t('home.jetLag.another')}
          </Button>
        </div>
      </div>
    </CardShell>
  );
}

export type { JetLagDirection, JetLagSeverity };
