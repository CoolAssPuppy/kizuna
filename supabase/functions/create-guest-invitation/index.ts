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

import { z } from 'zod';

import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { INVITATION_TTL_SECONDS } from '../_shared/constants.ts';
import { signInvitationToken } from '../_shared/invitationToken.ts';
import { getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

const AgeBracket = z.enum(['under_12', 'teen', 'adult']);

const RequestSchema = z
  .object({
    age_bracket: AgeBracket,
    first_name: z.string().trim().min(1, 'invalid_first_name').max(100),
    last_name: z.string().trim().min(1, 'invalid_last_name').max(100),
    // Required only for adults — minors have no email of their own.
    guest_email: z.string().trim().toLowerCase().email().optional(),
  })
  .refine((d) => d.age_bracket !== 'adult' || d.guest_email !== undefined, {
    path: ['guest_email'],
    message: 'invalid_email',
  });

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    // Surface the field-specific error code the SPA expects (the schema
    // attaches one to each constraint).
    const code = parsed.error.issues[0]?.message ?? 'invalid_body';
    return jsonResponse({ error: code }, { status: 400 });
  }
  const body = parsed.data;
  const ageBracket = body.age_bracket;
  const firstName = body.first_name;
  const lastName = body.last_name;

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
    return jsonResponse(
      { kind: 'minor', additional_guest: minor },
      { status: 201, headers: corsHeaders },
    );
  }

  // ------- Adult branch: full email + signed-token invite flow -------
  // Schema-guaranteed when age_bracket === 'adult'.
  const guestEmail = body.guest_email!;

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
  return jsonResponse(
    { kind: 'adult', invitation: updated },
    { status: 201, headers: corsHeaders },
  );
});
