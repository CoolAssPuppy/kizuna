// Edge function: accept-guest-invitation
//
// Anonymous guest provides a token + chosen password. We:
//   1. Verify the JWT signature and expiry
//   2. Look up the matching guest_invitations row
//   3. Create the auth.users record with the chosen password
//   4. Insert the public.users row (role=guest, sponsor_id from claim)
//   5. Insert a starter guest_profiles row (payment_status=pending)
//   6. Stamp guest_invitations.status=accepted, accepted_at, created_user_id
//
// Returns the new user's id and email so the SPA can sign them in directly.

import { z } from 'zod';

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { verifyInvitationToken } from '../_shared/invitationToken.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

const RequestSchema = z.object({
  token: z.string().min(1),
  // Supabase Auth requires at least 6, but we want stronger; the guest
  // password is the only credential they have for the rest of the event.
  password: z.string().min(8).max(256),
});

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const tokenSecret =
    Deno.env.get('KIZUNA_INVITATION_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? '';
  if (!tokenSecret) {
    return jsonResponse({ error: 'misconfigured' }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.path[0] === 'password' ? 'weak_password' : 'missing_fields';
    return jsonResponse({ error: code }, { status: 400 });
  }
  const body = parsed.data;

  const verification = await verifyInvitationToken({ secret: tokenSecret, token: body.token });
  if (!verification.ok) {
    return jsonResponse({ error: verification.reason }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: invitation, error: invitationError } = await admin
    .from('guest_invitations')
    .select('*')
    .eq('id', verification.claims.inv)
    .maybeSingle();
  if (invitationError || !invitation) {
    return jsonResponse({ error: 'invitation_not_found' }, { status: 404 });
  }
  // Lifecycle: pending -> sent -> accepted. Only 'sent' invitations
  // should be accepted in the new flow (sponsor has paid, the email
  // went out). 'pending' is allowed too so older invites issued before
  // the payment-gate change keep working.
  if (invitation.status !== 'sent' && invitation.status !== 'pending') {
    return jsonResponse({ error: 'invitation_already_used' }, { status: 409 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: verification.claims.email,
    password: body.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return jsonResponse({ error: createError?.message ?? 'create_user_failed' }, { status: 500 });
  }
  const newUserId = created.user.id;

  const { error: usersError } = await admin.from('users').insert({
    id: newUserId,
    email: verification.claims.email,
    role: 'guest',
    sponsor_id: verification.claims.sub,
    auth_provider: 'email_password',
  });
  if (usersError) {
    return jsonResponse({ error: usersError.message }, { status: 500 });
  }

  // The sponsor pays the bundled fee BEFORE the invite email goes
  // out, so by the time we reach this point the guest's seat has
  // already been settled. Stamp 'paid' on the new guest_profiles row
  // so guard_guest_profile_completion doesn't immediately block
  // legal_name from landing.
  // Pull first/last from the invitation row the sponsor filled in;
  // legal_name is whatever the sponsor typed verbatim (the guest can
  // refine it from the registration UI later).
  const composedName = [invitation.first_name, invitation.last_name]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
  const { error: guestProfilesError } = await admin.from('guest_profiles').insert({
    user_id: newUserId,
    sponsor_id: verification.claims.sub,
    first_name: invitation.first_name,
    last_name: invitation.last_name,
    legal_name: composedName.length > 0 ? composedName : verification.claims.email,
    relationship: 'partner',
    payment_status: 'paid',
  });
  if (guestProfilesError) {
    return jsonResponse({ error: guestProfilesError.message }, { status: 500 });
  }

  await admin
    .from('guest_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      created_user_id: newUserId,
    })
    .eq('id', invitation.id);

  return jsonResponse({
    invitationId: invitation.id,
    userId: newUserId,
    guestEmail: verification.claims.email,
  });
});
