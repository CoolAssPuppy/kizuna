import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type EventRow = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

/** Admin: every event in the database, newest first. */
export async function fetchAllEvents(client: AppSupabaseClient): Promise<EventRow[]> {
  const { data, error } = await client
    .from('events')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEventById(
  client: AppSupabaseClient,
  id: string,
): Promise<EventRow | null> {
  const { data, error } = await client.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createEvent(
  client: AppSupabaseClient,
  input: EventInsert,
): Promise<EventRow> {
  const { data, error } = await client.from('events').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  client: AppSupabaseClient,
  id: string,
  patch: EventUpdate,
): Promise<EventRow> {
  const { data, error } = await client.from('events').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Hard-delete an event and every event-scoped row that references it
 * (sessions, registrations, accommodations, transport, itinerary,
 * documents, etc.). User-scoped data (employee_profiles,
 * additional_guests, swag_sizes, attendee_profiles) survives because
 * those describe the person, not the event.
 *
 * Routes through the admin-guarded delete_event_cascade SECURITY
 * DEFINER function. The previous direct `.delete()` path silently
 * failed for non-admins via RLS instead of returning a typed error;
 * that path is gone.
 */
export async function deleteEvent(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('delete_event_cascade', { p_event_id: id });
  if (error) throw error;
}
