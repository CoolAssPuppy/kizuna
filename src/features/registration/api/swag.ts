import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SwagItemRow = Database['public']['Tables']['swag_items']['Row'];
export type SwagSelectionRow = Database['public']['Tables']['swag_selections']['Row'];

export interface SwagSelectionInput {
  swagItemId: string;
  /** null when opted_out is true. */
  size: string | null;
  optedOut: boolean;
  /** Sponsor saving for an additional_guest; omit when saving for self. */
  additionalGuestId?: string | null;
}

/**
 * Catalogue read for the attendee picker. Filters out hidden items so a
 * preview row never reaches the attendee form. Admin code uses
 * `loadSwagItemsAll` instead.
 */
export async function loadVisibleSwagItems(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SwagItemRow[]> {
  const { data, error } = await client
    .from('swag_items')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_hidden', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Admin-only catalogue read; hidden items included. */
export async function loadSwagItemsAll(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SwagItemRow[]> {
  const { data, error } = await client
    .from('swag_items')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface OwnedSwagSelections {
  /** Selections owned directly by the calling user. */
  own: SwagSelectionRow[];
  /** Selections owned by additional_guests the caller sponsors. */
  byAdditionalGuest: SwagSelectionRow[];
}

/**
 * Loads every selection visible to the caller — their own plus any rows
 * for their additional_guests. The caller is both the user (own rows)
 * and the sponsor (guest rows) — kept as one parameter so call sites
 * can't accidentally pass mismatched ids.
 */
export async function loadMySwagSelections(
  client: AppSupabaseClient,
  userId: string,
): Promise<OwnedSwagSelections> {
  const [own, guests] = await Promise.all([
    client.from('swag_selections').select('*').eq('user_id', userId),
    client
      .from('swag_selections')
      .select('*, additional_guests!inner(sponsor_id)')
      .eq('additional_guests.sponsor_id', userId),
  ]);
  if (own.error) throw own.error;
  if (guests.error) throw guests.error;
  return { own: own.data ?? [], byAdditionalGuest: guests.data ?? [] };
}

/**
 * Bulk save. The RPC merges rather than replaces — items not in the
 * payload keep their prior selection — so partial saves are safe.
 */
export async function saveSwagSelections(
  client: AppSupabaseClient,
  eventId: string,
  selections: ReadonlyArray<SwagSelectionInput>,
): Promise<void> {
  const payload = selections.map((s) => ({
    swag_item_id: s.swagItemId,
    size: s.size,
    opted_out: s.optedOut,
    additional_guest_id: s.additionalGuestId ?? null,
  }));
  const { error } = await client.rpc('set_swag_selections', {
    p_event_id: eventId,
    p_selections: payload,
  });
  if (error) throw error;
}

/** Admin-only toggle. true = freeze attendee selections, false = allow edits again. */
export async function setSwagLock(
  client: AppSupabaseClient,
  eventId: string,
  locked: boolean,
): Promise<void> {
  const { error } = await client.rpc('set_swag_lock', {
    p_event_id: eventId,
    p_locked: locked,
  });
  if (error) throw error;
}

export type SwagItemPatch = Partial<
  Pick<
    SwagItemRow,
    | 'name'
    | 'description'
    | 'image_path'
    | 'size_image_path'
    | 'is_hidden'
    | 'allows_opt_out'
    | 'sizes'
    | 'sort_order'
  >
>;

export interface CreateSwagItemInput {
  /**
   * Optional explicit id. The admin form generates a uuid up front so the
   * StorageImageUploader can write to the correct `<event>/swag/<id>/`
   * folder before the row exists; passing it here lets the insert reuse
   * that uuid so the persisted image_path resolves cleanly afterwards.
   */
  id?: string;
  eventId: string;
  name: string;
  description?: string | null;
  imagePath?: string | null;
  sizeImagePath?: string | null;
  isHidden?: boolean;
  allowsOptOut?: boolean;
  sizes?: string[];
  sortOrder?: number;
}

export async function createSwagItem(
  client: AppSupabaseClient,
  input: CreateSwagItemInput,
): Promise<SwagItemRow> {
  const insertRow = {
    name: input.name,
    event_id: input.eventId,
    description: input.description ?? null,
    image_path: input.imagePath ?? null,
    size_image_path: input.sizeImagePath ?? null,
    is_hidden: input.isHidden ?? false,
    allows_opt_out: input.allowsOptOut ?? true,
    sizes: input.sizes ?? [],
    sort_order: input.sortOrder ?? 0,
    ...(input.id ? { id: input.id } : {}),
  };
  const { data, error } = await client.from('swag_items').insert(insertRow).select('*').single();
  if (error) throw error;
  return data;
}

/**
 * Bulk-stamps sort_order to match the order of the supplied ids.
 * Issued in parallel — one network turn — same shape as
 * `reorderRowsByPosition` in `src/lib/reorder.ts` but writes
 * `sort_order` instead of `position`.
 */
export async function reorderSwagItems(
  client: AppSupabaseClient,
  orderedIds: ReadonlyArray<string>,
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, sort_order) =>
      client.from('swag_items').update({ sort_order }).eq('id', id),
    ),
  );
}

export async function updateSwagItem(
  client: AppSupabaseClient,
  id: string,
  patch: SwagItemPatch,
): Promise<SwagItemRow> {
  const { data, error } = await client
    .from('swag_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSwagItem(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('swag_items').delete().eq('id', id);
  if (error) throw error;
}
