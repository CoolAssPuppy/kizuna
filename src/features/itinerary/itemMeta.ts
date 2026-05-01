import { Bell, Hotel, Megaphone, Plane, Sparkles, Van } from 'lucide-react';

import type { ItineraryItemType } from './types';

interface ItemMeta {
  Icon: typeof Plane;
  /** Tailwind classes that paint the icon chip background + text. */
  chipClass: string;
  /** Tailwind classes for the timeline rail dot. */
  dotClass: string;
}

/**
 * Visual mapping for itinerary item types. Centralised so the rail dot,
 * chip, and any related affordances stay in sync as we add types.
 */
export const ITEM_META: Record<ItineraryItemType, ItemMeta> = {
  session: {
    Icon: Sparkles,
    chipClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  flight: {
    Icon: Plane,
    chipClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    dotClass: 'bg-sky-500',
  },
  transport: {
    Icon: Van,
    chipClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  accommodation: {
    Icon: Hotel,
    chipClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    dotClass: 'bg-violet-500',
  },
  announcement: {
    Icon: Megaphone,
    chipClass: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
    dotClass: 'bg-zinc-500',
  },
  reminder: {
    Icon: Bell,
    chipClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    dotClass: 'bg-rose-500',
  },
};

