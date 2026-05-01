import { callEdgeFunction } from '@/lib/edgeFunction';
import type { AppSupabaseClient } from '@/lib/supabase';

import type { AdditionalGuestRow, GuestAgeBracket, GuestInvitationRow } from './types';

export async function listGuestInvitations(
  client: AppSupabaseClient,
  sponsorUserId: string,
): Promise<GuestInvitationRow[]> {
  const { data, error } = await client
    .from('guest_invitations')
    .select('*')
    .eq('sponsor_id', sponsorUserId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAdditionalGuests(
  client: AppSupabaseClient,
  sponsorUserId: string,
): Promise<AdditionalGuestRow[]> {
  const { data, error } = await client
    .from('additional_guests')
    .select('*')
    .eq('sponsor_id', sponsorUserId)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function cancelGuestInvitation(
  client: AppSupabaseClient,
  invitationId: string,
): Promise<void> {
  const { error } = await client
    .from('guest_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);
  if (error) throw error;
}

export interface UpdateGuestInvitationArgs {
  id: string;
  fullName: string;
  guestEmail: string;
}

/**
 * Sponsor edits a pending or already-sent invitation. Once the guest has
 * accepted (status='accepted') the row points at a real auth user — the
 * sponsor stops being authoritative for name/email and the call site
 * blocks edits before this fires. RLS narrows the row scope to the
 * sponsor anyway.
 */
export async function updateGuestInvitation(
  client: AppSupabaseClient,
  args: UpdateGuestInvitationArgs,
): Promise<void> {
  const { error } = await client
    .from('guest_invitations')
    .update({
      full_name: args.fullName,
      guest_email: args.guestEmail.toLowerCase(),
    })
    .eq('id', args.id);
  if (error) throw error;
}

export async function renameAdditionalGuest(
  client: AppSupabaseClient,
  args: { id: string; fullName: string },
): Promise<void> {
  const { error } = await client
    .from('additional_guests')
    .update({ full_name: args.fullName })
    .eq('id', args.id);
  if (error) throw error;
}

export async function removeAdditionalGuest(client: AppSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('additional_guests').delete().eq('id', id);
  if (error) throw error;
}

interface InvokeContext {
  client: AppSupabaseClient;
}

export interface InviteGuestArgs {
  ageBracket: GuestAgeBracket;
  fullName: string;
  /** Required only when ageBracket = 'adult'. The edge function rejects empty for adults. */
  guestEmail?: string;
}

export type InviteGuestResult =
  | { kind: 'adult'; invitation: GuestInvitationRow }
  | { kind: 'minor'; additional_guest: AdditionalGuestRow };

/**
 * Invite a guest. Adults (18+) get an email + signed-token flow that
 * lands them in guest_invitations. Minors (under 12 / teen) skip auth
 * entirely and write straight into additional_guests with a
 * sponsor-paid fee. The edge function captures fee_amount server-side
 * so the SPA cannot under-quote.
 */
export function inviteGuest(
  { client }: InvokeContext,
  args: InviteGuestArgs,
): Promise<InviteGuestResult> {
  return callEdgeFunction<InviteGuestResult>(client, 'create-guest-invitation', {
    age_bracket: args.ageBracket,
    full_name: args.fullName,
    ...(args.guestEmail ? { guest_email: args.guestEmail } : {}),
  });
}

interface AcceptArgs {
  token: string;
  password: string;
}

export interface AcceptInvitationResponse {
  invitationId: string;
  userId: string;
  guestEmail: string;
}

/**
 * Verifies the invitation token, creates the auth user + public.users +
 * guest_profiles rows, and returns identifiers so the SPA can sign in.
 */
export function acceptGuestInvitation(
  { client }: InvokeContext,
  args: AcceptArgs,
): Promise<AcceptInvitationResponse> {
  return callEdgeFunction<AcceptInvitationResponse>(client, 'accept-guest-invitation', {
    token: args.token,
    password: args.password,
  });
}
