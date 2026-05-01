import type { AppSupabaseClient } from '@/lib/supabase';

import { slugifyChannelName } from '../slug';

export interface ChannelRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_system: boolean;
  archived_at: string | null;
}

export interface ChannelWithLastMessage extends ChannelRow {
  last_message_body: string | null;
  last_message_sent_at: string | null;
}

export interface CreateChannelInput {
  name: string;
  description: string | null;
}

/**
 * Lists active channels (archived_at is null). The last message is read
 * via a follow-up query to keep the join simple — Postgres can already
 * use the messages_channel_sent_at_idx index for this.
 */
export async function listChannelsWithLastMessage(
  client: AppSupabaseClient,
): Promise<ChannelWithLastMessage[]> {
  const { data: channels, error } = await client
    .from('channels')
    .select('id, slug, name, description, created_by, is_system, archived_at')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const slugs = (channels ?? []).map((c) => c.slug);
  if (slugs.length === 0) return [];

  const { data: messages } = await client
    .from('messages')
    .select('channel, body, sent_at')
    .in('channel', slugs)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false });

  const lastBySlug = new Map<string, { body: string; sent_at: string }>();
  for (const m of messages ?? []) {
    if (!lastBySlug.has(m.channel)) lastBySlug.set(m.channel, { body: m.body, sent_at: m.sent_at });
  }

  return (channels ?? []).map((c) => {
    const last = lastBySlug.get(c.slug);
    return {
      ...c,
      last_message_body: last?.body ?? null,
      last_message_sent_at: last?.sent_at ?? null,
    };
  });
}

/**
 * Creates a new community channel owned by the current user. Returns the
 * created row. Throws on collision so callers can show a friendly error.
 */
export async function createChannel(
  client: AppSupabaseClient,
  userId: string,
  input: CreateChannelInput,
): Promise<ChannelRow> {
  const slug = slugifyChannelName(input.name);
  if (!slug) {
    throw new Error('Channel name produced an empty slug');
  }
  const { data, error } = await client
    .from('channels')
    .insert({
      slug,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      created_by: userId,
    })
    .select('id, slug, name, description, created_by, is_system, archived_at')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchChannelBySlug(
  client: AppSupabaseClient,
  slug: string,
): Promise<ChannelRow | null> {
  const { data, error } = await client
    .from('channels')
    .select('id, slug, name, description, created_by, is_system, archived_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}
