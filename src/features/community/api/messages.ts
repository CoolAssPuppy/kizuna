import type { AppSupabaseClient, Joined } from '@/lib/supabase';
import { flatJoin } from '@/lib/supabase';

export interface MessageWithSender {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  edited_at: string | null;
  media_url: string | null;
  reactions: Record<string, string[]>;
  sender: {
    email: string;
    employee_profiles: { preferred_name: string | null; avatar_url: string | null } | null;
    guest_profiles: { full_name: string } | null;
  } | null;
}

const SELECT = `
  id, sender_id, body, sent_at, edited_at, media_url, reactions,
  sender:users!messages_sender_id_fkey (
    email,
    employee_profiles ( preferred_name, avatar_url ),
    guest_profiles!guest_profiles_user_id_fkey ( full_name )
  )
`;

export async function fetchMessages(
  client: AppSupabaseClient,
  channelSlug: string,
  limit = 200,
): Promise<MessageWithSender[]> {
  const { data, error } = await client
    .from('messages')
    .select(SELECT)
    .eq('channel', channelSlug)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return ((data ?? []) as unknown as Array<Omit<MessageWithSender, 'sender' | 'reactions'> & {
    sender: Joined<{
      email: string;
      employee_profiles: Joined<{ preferred_name: string | null; avatar_url: string | null }>;
      guest_profiles: Joined<{ full_name: string }>;
    }>;
    reactions: Record<string, string[]> | null;
  }>)
    .map((row) => ({
      ...row,
      reactions: row.reactions ?? {},
      sender: (() => {
        const u = flatJoin<{
          email: string;
          employee_profiles: Joined<{ preferred_name: string | null; avatar_url: string | null }>;
          guest_profiles: Joined<{ full_name: string }>;
        }>(row.sender);
        if (!u) return null;
        return {
          email: u.email,
          employee_profiles: flatJoin(u.employee_profiles) ?? null,
          guest_profiles: flatJoin(u.guest_profiles) ?? null,
        };
      })(),
    }))
    .reverse();
}

export interface SendMessageInput {
  channelSlug: string;
  body: string;
  mediaUrl?: string | null;
}

export async function sendMessage(
  client: AppSupabaseClient,
  senderId: string,
  input: SendMessageInput,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('messages')
    .insert({
      sender_id: senderId,
      channel: input.channelSlug,
      body: input.body,
      media_url: input.mediaUrl ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteMessage(
  client: AppSupabaseClient,
  messageId: string,
): Promise<void> {
  const { error } = await client
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function broadcastToAllChannels(
  client: AppSupabaseClient,
  body: string,
): Promise<number> {
  const { data, error } = await client.rpc('broadcast_to_all_channels', { p_body: body });
  if (error) throw error;
  return data ?? 0;
}
