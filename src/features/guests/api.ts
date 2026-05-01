import { callEdgeFunction } from '@/lib/edgeFunction';
import type { AppSupabaseClient } from '@/lib/supabase';

import type { GuestInvitationRow } from './types';

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

interface InvokeContext {
  client: AppSupabaseClient;
}

interface CreateInvitationArgs {
  guestEmail: string;
  /** Sponsoring employee. Must equal auth.uid() under RLS. */
  sponsorUserId: string;
}

/**
 * Creates a guest invitation. The edge function signs a JWT, writes the
 * guest_invitations row, and triggers the invite email through Resend (or
 * the local stub when no key is configured).
 */
export function createGuestInvitation(
  { client }: InvokeContext,
  args: CreateInvitationArgs,
): Promise<GuestInvitationRow> {
  return callEdgeFunction<GuestInvitationRow>(client, 'create-guest-invitation', {
    guest_email: args.guestEmail,
    sponsor_user_id: args.sponsorUserId,
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

