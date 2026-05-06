import { resolveProfileName } from '@/lib/fullName';
import { flatJoin, type AppSupabaseClient, type Joined } from '@/lib/supabase';

import type { CsvRow } from '../csv';
import type { NameProfile } from './shared';

export interface SwagOrderRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  swag_item: string;
  size: string;
  opted_out: boolean;
}

/**
 * Per-item swag order export for the ops team. One row per (attendee,
 * swag_item). opted_out rows are kept so the order vendor can see who
 * declined a piece — easier than reconciling the absence of a row.
 */
export async function fetchSwagOrder(client: AppSupabaseClient): Promise<SwagOrderRow[]> {
  const { data, error } = await client.from('swag_selections').select(
    `
      size, opted_out,
      swag_item:swag_items ( name ),
      user:users!swag_selections_user_id_fkey (
        email,
        employee_profiles ( first_name, last_name, preferred_name, legal_name ),
        guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
      ),
      additional_guests ( first_name, last_name, sponsor:users!additional_guests_sponsor_id_fkey ( email ) )
    `,
  );
  if (error) throw error;

  return (data ?? []).map((row) => {
    const itemName = flatJoin<{ name: string }>(row.swag_item)?.name ?? '';
    const user = flatJoin<{
      email: string;
      employee_profiles: Joined<NameProfile>;
      guest_profiles: Joined<{ first_name: string; last_name: string }>;
    }>(row.user);
    const additional = flatJoin<{
      first_name: string;
      last_name: string;
      sponsor: Joined<{ email: string }>;
    }>(row.additional_guests);

    if (additional) {
      return {
        first_name: additional.first_name,
        last_name: additional.last_name,
        email: flatJoin<{ email: string }>(additional.sponsor)?.email ?? '',
        swag_item: itemName,
        size: row.size ?? '',
        opted_out: row.opted_out,
      };
    }

    const { first, last } = resolveProfileName(
      flatJoin(user?.employee_profiles),
      flatJoin(user?.guest_profiles),
    );
    return {
      first_name: first,
      last_name: last,
      email: user?.email ?? '',
      swag_item: itemName,
      size: row.size ?? '',
      opted_out: row.opted_out,
    };
  });
}

export interface SwagTotalsRow extends CsvRow {
  swag_item: string;
  size: string;
  quantity: number;
  opted_out: number;
}

/**
 * Aggregates swag selections by (item, size) so the ops team can place
 * a vendor order without flipping through one row per attendee. Counts
 * opt-outs separately under size = "(opted out)" so a quick glance
 * shows both the "to order" and "decline" buckets.
 */
export async function fetchSwagOrderTotals(client: AppSupabaseClient): Promise<SwagTotalsRow[]> {
  const { data, error } = await client
    .from('swag_selections')
    .select(`size, opted_out, swag_item:swag_items ( name )`);
  if (error) throw error;

  const buckets = new Map<string, SwagTotalsRow>();
  for (const row of data ?? []) {
    const itemName = flatJoin<{ name: string }>(row.swag_item)?.name ?? '';
    const sizeLabel = row.opted_out ? '(opted out)' : (row.size ?? '');
    const key = `${itemName} ${sizeLabel}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.quantity += row.opted_out ? 0 : 1;
      bucket.opted_out += row.opted_out ? 1 : 0;
    } else {
      buckets.set(key, {
        swag_item: itemName,
        size: sizeLabel,
        quantity: row.opted_out ? 0 : 1,
        opted_out: row.opted_out ? 1 : 0,
      });
    }
  }

  // Sort by item name, then size — gives the ops team a stable layout
  // that mirrors how the catalogue is structured.
  return [...buckets.values()].sort((a, b) => {
    if (a.swag_item !== b.swag_item) return a.swag_item.localeCompare(b.swag_item);
    return a.size.localeCompare(b.size);
  });
}
