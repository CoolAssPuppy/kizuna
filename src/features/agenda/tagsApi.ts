import type { AppSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SessionTag = Database['public']['Tables']['session_tags']['Row'];
type SessionTagInsert = Database['public']['Tables']['session_tags']['Insert'];

export async function fetchEventTags(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SessionTag[]> {
  const { data, error } = await client
    .from('session_tags')
    .select('*')
    .eq('event_id', eventId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTagsForSessions(
  client: AppSupabaseClient,
  sessionIds: ReadonlyArray<string>,
): Promise<Map<string, SessionTag[]>> {
  const result = new Map<string, SessionTag[]>();
  if (sessionIds.length === 0) return result;
  const { data, error } = await client
    .from('session_tag_assignments')
    .select('session_id, session_tags ( id, event_id, name, color, position, created_at )')
    .in('session_id', sessionIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const tag = row.session_tags;
    if (!tag) continue;
    const list = result.get(row.session_id) ?? [];
    list.push(tag);
    result.set(row.session_id, list);
  }
  // Stable sort by position so callers don't have to.
  for (const list of result.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  return result;
}

export async function createTag(
  client: AppSupabaseClient,
  args: { eventId: string; name: string; color: string; position?: number },
): Promise<SessionTag> {
  const payload: SessionTagInsert = {
    event_id: args.eventId,
    name: args.name,
    color: args.color,
    ...(args.position !== undefined ? { position: args.position } : {}),
  };
  const { data, error } = await client.from('session_tags').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateTag(
  client: AppSupabaseClient,
  id: string,
  patch: Partial<Pick<SessionTag, 'name' | 'color' | 'position'>>,
): Promise<SessionTag> {
  const { data, error } = await client
    .from('session_tags')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTag(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('session_tags').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Replaces the tag set for a session. Diffing minimises churn so the
 * realtime stream emits only the actual additions and removals.
 */
export async function setSessionTags(
  client: AppSupabaseClient,
  args: { sessionId: string; tagIds: ReadonlyArray<string> },
): Promise<void> {
  const { data: current, error: readErr } = await client
    .from('session_tag_assignments')
    .select('tag_id')
    .eq('session_id', args.sessionId);
  if (readErr) throw readErr;

  const currentIds = new Set((current ?? []).map((r) => r.tag_id));
  const desiredIds = new Set(args.tagIds);
  const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

  if (toAdd.length > 0) {
    const { error } = await client
      .from('session_tag_assignments')
      .insert(toAdd.map((tag_id) => ({ session_id: args.sessionId, tag_id })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await client
      .from('session_tag_assignments')
      .delete()
      .eq('session_id', args.sessionId)
      .in('tag_id', toRemove);
    if (error) throw error;
  }
}
