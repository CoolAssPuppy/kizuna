import type { Database } from '@/types/database.types';

export type ItineraryItemRow = Database['public']['Tables']['itinerary_items']['Row'];
export type ItineraryItemType = ItineraryItemRow['item_type'];

export interface ItineraryDay {
  /** Day key in YYYY-MM-DD form, in the user's local timezone. */
  date: string;
  items: ItineraryItemRow[];
}
