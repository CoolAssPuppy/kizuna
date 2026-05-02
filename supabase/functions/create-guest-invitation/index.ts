// Edge function: create-guest-invitation
//
// Authenticated employee asks Kizuna to invite a guest. The flow forks
// on `age_bracket`:
//
//   * 'adult' (18+) -> insert into guest_invitations with status='pending'
//     and a signed 7-day JWT. The invite email DOES NOT go out here —
//     it lands only after the sponsor pays the bundled fee, at which
//     point stripe-webhook flips status='sent' and dispatches the mail.
//   * 'under_12' / 'teen' -> insert into additional_guests directly.
//     No email, no signed token, no auth user — minors ride on the
//     sponsor's registration. The trigger guard_guest_profile_completion
//     plus payment_status keep them blocked until the sponsor pays.
//
// Both branches charge the sponsor; fee_amount is captured server-side
// from guest_fee_for_bracket() to make sure the SPA cannot under-quote.

import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { INVITATION_TTL_SECONDS } from '../_shared/constants.ts';
import { signInvitationToken } from '../_shared/invitationToken.ts';
import { getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

type AgeBracket = 'under_12' | 'teen' | 'adult';

interface RequestBody {
  age_bracket?: AgeBracket;
  first_name?: string;
  last_name?: string;
  guest_email?: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  const tokenSecret =
    Deno.env.get('KIZUNA_INVITATION_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? '';
  if (!tokenSecret) {
    return jsonResponse({ error: 'invitation_secret_missing' }, { status: 500 });
  }

  const client = getUserClient(authHeader);
  const caller = await getCallerUser(client, authHeader);
  if (!caller) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const sponsorUserId = caller.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }

  const ageBracket = body.age_bracket;
  if (ageBracket !== 'under_12' && ageBracket !== 'teen' && ageBracket !== 'adult') {
    return jsonResponse({ error: 'invalid_age_bracket' }, { status: 400 });
  }

  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  if (!firstName || firstName.length < 1) {
    return jsonResponse({ error: 'invalid_first_name' }, { status: 400 });
  }
  if (!lastName || lastName.length < 1) {
    return jsonResponse({ error: 'invalid_last_name' }, { status: 400 });
  }

  // ------- Minor branch: write straight into additional_guests -------
  if (ageBracket !== 'adult') {
    const { data: minor, error: minorError } = await client
      .from('additional_guests')
      .insert({
        sponsor_id: sponsorUserId,
        first_name: firstName,
        last_name: lastName,
        age_bracket: ageBracket,
        // fee_amount is overwritten by the BIU trigger; pass 0 so the
        // NOT NULL constraint is satisfied without us guessing the
        // canonical price client-side.
        fee_amount: 0,
      })
      .select()
      .single();
    if (minorError || !minor) {
      return jsonResponse({ error: minorError?.message ?? 'minor_insert_failed' }, { status: 500 });
    }
    return jsonResponse({ kind: 'minor', additional_guest: minor }, { status: 201, headers: corsHeaders });
  }

  // ------- Adult branch: full email + signed-token invite flow -------
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
      first_name: firstName,
      last_name: lastName,
      age_bracket: 'adult',
      // BIU trigger overwrites with guest_fee_for_bracket('adult').
      fee_amount: 0,
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

  // The invitation email DOES NOT go out here. It lands only after the
  // sponsor pays the bundled fee — stripe-webhook flips status='sent'
  // and dispatches the mail then. Returning the invitation row lets the
  // SPA render the "Pending payment" badge in GuestsSection.
  return jsonResponse({ kind: 'adult', invitation: updated }, { status: 201, headers: corsHeaders });
});
