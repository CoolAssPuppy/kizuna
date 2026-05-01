import { CircleDot, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';
import { useTranslation } from 'react-i18next';

import { ITEM_META } from './itemMeta';
import type { ItineraryItemRow } from './types';

interface Props {
  items: ReadonlyArray<ItineraryItemRow>;
  /** Override now() in tests. */
  now?: Date;
}

interface Slot {
  kind: 'now' | 'next';
  item: ItineraryItemRow;
  /** Minutes until item starts (for "next") or item ends (for "now"). */
  minutes: number;
}

function findSlot(items: ReadonlyArray<ItineraryItemRow>, now: Date): Slot | null {
  const nowMs = now.getTime();
  // Sort by start ascending — caller usually already does, but defensive
  // copy means the helper is safe to call directly from tests.
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  for (const item of sorted) {
    const startMs = new Date(item.starts_at).getTime();
    const endMs = item.ends_at ? new Date(item.ends_at).getTime() : startMs + 60 * 60 * 1000;
    if (startMs <= nowMs && nowMs < endMs) {
      return { kind: 'now', item, minutes: Math.max(1, Math.round((endMs - nowMs) / 60000)) };
    }
    if (startMs > nowMs) {
      return { kind: 'next', item, minutes: Math.round((startMs - nowMs) / 60000) };
    }
  }
  return null;
}

type GapTranslate = (key: string, options: { count: number }) => string;

function formatHumanGap(minutes: number, t: GapTranslate): string {
  if (minutes < 60) return t('itinerary.nowNext.inMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('itinerary.nowNext.inHours', { count: hours });
  const days = Math.round(hours / 24);
  return t('itinerary.nowNext.inDays', { count: days });
}

/**
 * Surfaces what is happening right now or what is coming up next so the
 * user doesn't have to scan the whole timeline to find it. Re-evaluates
 * every minute so "in 12 minutes" stays fresh without a full re-render.
 */
export function NowNextCard({ items, now: nowOverride }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const [now, setNow] = useState<Date>(() => nowOverride ?? new Date());

  useMountEffect(() => {
    if (nowOverride) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  });

  const slot = findSlot(items, now);
  if (!slot) return null;

  const meta = ITEM_META[slot.item.item_type];
  const Icon = meta.Icon;
  const isNow = slot.kind === 'now';
  const eyebrow = isNow ? t('itinerary.nowNext.live') : t('itinerary.nowNext.upcoming');
  const trail = isNow
    ? t('itinerary.nowNext.endsIn', { gap: formatHumanGap(slot.minutes, t) })
    : t('itinerary.nowNext.startsIn', { gap: formatHumanGap(slot.minutes, t) });

  return (
    <article className="relative flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <span
        aria-hidden
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.chipClass}`}
      >
        <Icon className="h-6 w-6" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
          {isNow ? (
            <CircleDot aria-hidden className="h-3 w-3 animate-pulse text-emerald-500" />
          ) : null}
          <span className={isNow ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}>
            {eyebrow}
          </span>
        </div>
        <p className="mt-1 truncate text-base font-semibold leading-snug">{slot.item.title}</p>
        {slot.item.subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{slot.item.subtitle}</p>
        ) : null}
      </div>

      <div className="hidden flex-col items-end text-right text-sm sm:flex">
        <span className="font-medium tabular-nums">{trail}</span>
        <ChevronRight aria-hidden className="mt-1 h-4 w-4 text-muted-foreground" />
      </div>
    </article>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const __TEST = { findSlot };
