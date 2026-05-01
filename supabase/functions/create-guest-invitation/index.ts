// deno-lint-ignore-file no-explicit-any
// Edge function: create-guest-invitation
//
// Authenticated employee asks Kizuna to invite a guest. We:
//   1. Insert the guest_invitations row (RLS scopes this to the sponsor)
//   2. Sign a 7-day JWT
//   3. Stamp it onto the row
//   4. Send the invitation email via Resend (or stub when no key)
//
// The Resend call is best-effort — we still return the row even if the
// email send fails, so the admin can copy the link manually if needed.

import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { INVITATION_TTL_SECONDS } from '../_shared/constants.ts';
import { signInvitationToken } from '../_shared/invitationToken.ts';
import { getUserClient } from '../_shared/supabaseClient.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const tokenSecret =
    Deno.env.get('KIZUNA_INVITATION_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? '';
  if (!tokenSecret) {
    return jsonResponse({ error: 'invitation_secret_missing' }, { status: 500 });
  }

  const client = getUserClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const sponsorUserId = userData.user.id;

  let body: { guest_email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }
  const guestEmail = body.guest_email?.trim().toLowerCase();
  if (!guestEmail || !guestEmail.includes('@')) {
    return jsonResponse({ error: 'invalid_email' }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_SECONDS * 1000).toISOString();
  const { data: invitation, error: insertError } = await client
    .from('guest_invitations')
    .insert({
      sponsor_id: sponsorUserId,
      guest_email: guestEmail,
      signed_token: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError || !invitation) {
    return jsonResponse({ error: insertError?.message ?? 'insert_failed' }, { status: 500 });
  }

  const signedToken = await signInvitationToken({
    secret: tokenSecret,
    invitationId: invitation.id,
    sponsorUserId,
    guestEmail,
  });

  const { data: updated, error: updateError } = await client
    .from('guest_invitations')
    .update({ signed_token: signedToken })
    .eq('id', invitation.id)
    .select()
    .single();

  if (updateError || !updated) {
    return jsonResponse({ error: updateError?.message ?? 'update_failed' }, { status: 500 });
  }

  // Best-effort email send. Resend stub mode logs and returns success.
  await tryEmail(signedToken, guestEmail).catch((err: unknown) => {
    console.warn('[kizuna] resend send failed', err);
  });

  return jsonResponse(updated, { status: 201, headers: corsHeaders });
});

async function tryEmail(token: string, guestEmail: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@kizuna.example';
  const acceptUrl = `${Deno.env.get('KIZUNA_PUBLIC_URL') ?? 'http://localhost:5173'}/accept-invitation?token=${encodeURIComponent(token)}`;

  if (!apiKey) {
    console.info('[kizuna] RESEND_API_KEY missing — would have sent invite to %s with link %s', guestEmail, acceptUrl);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: guestEmail,
      subject: "You're invited to Supafest",
      html: `<p>You've been invited to attend Supafest. <a href="${acceptUrl}">Accept your invitation</a> within 7 days.</p>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`resend ${response.status}: ${text}`);
  }
}
