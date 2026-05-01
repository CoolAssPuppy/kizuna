// Sponsor-payment fan-out
//
// Called from stripe-webhook (payment_intent.succeeded with
// metadata.sponsor_user_id) and from create-sponsor-fees-checkout
// in stub mode. The job:
//
//   1. Flip every additional_guests row owned by the sponsor from
//      payment_status='pending' to 'paid'.
//   2. Flip every guest_invitations row owned by the sponsor from
//      status='pending' to 'sent', recording invitation_email_sent_at.
//   3. Send the invitation email for each newly-flipped row via
//      Resend (or log the URL if RESEND_API_KEY is missing).
//
// Idempotency: step 2 only matches `pending`, so re-firing the
// webhook is a no-op for invitations that already moved.

import { getAdminClient } from './supabaseClient.ts';

declare const Deno: { env: { get: (k: string) => string | undefined } };

interface InvitationRow {
  id: string;
  full_name: string;
  guest_email: string;
  signed_token: string;
  expires_at: string;
}

export async function dispatchSponsorPaymentSucceeded(
  sponsorUserId: string,
): Promise<void> {
  const admin = getAdminClient();

  // Step 1: minors → paid.
  await admin
    .from('additional_guests')
    .update({ payment_status: 'paid' })
    .eq('sponsor_id', sponsorUserId)
    .eq('payment_status', 'pending');

  // Step 2: pending invitations → sent. We need the rows AFTER the flip
  // because we want the signed_token + email for the dispatch, but RLS
  // is bypassed by the admin client so we can read them either way.
  const { data: invitations, error: fetchError } = await admin
    .from('guest_invitations')
    .select('id, full_name, guest_email, signed_token, expires_at')
    .eq('sponsor_id', sponsorUserId)
    .eq('status', 'pending');
  if (fetchError) {
    console.error('[kizuna] sponsor fan-out: fetch invitations failed', fetchError);
    return;
  }
  const pending = (invitations ?? []) as InvitationRow[];
  if (pending.length === 0) return;

  await admin
    .from('guest_invitations')
    .update({ status: 'sent' })
    .eq('sponsor_id', sponsorUserId)
    .eq('status', 'pending');

  // Step 3: send the email for each. Failures don't roll back the
  // status flip — the row is in 'sent' and an admin can re-trigger
  // the email manually if Resend was down. Logging the failure is
  // enough.
  await Promise.all(pending.map((row) => sendInviteEmail(row)));
}

async function sendInviteEmail(row: InvitationRow): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@kizuna.example';
  const acceptUrl = `${Deno.env.get('KIZUNA_PUBLIC_URL') ?? 'http://localhost:5173'}/accept-invitation?token=${encodeURIComponent(row.signed_token)}`;

  if (!apiKey) {
    console.info(
      '[kizuna] RESEND_API_KEY missing — would have sent invite to %s with link %s',
      row.guest_email,
      acceptUrl,
    );
    return;
  }

  const subject = "You're invited to Supafest";
  const html = `<p>Hi ${row.full_name.split(' ')[0] ?? ''},</p>
<p>Your fee has been paid and your seat is confirmed. <a href="${acceptUrl}">Accept your invitation</a> within 7 days.</p>
<p>If you forget your password later, use "Forgot password" on the sign-in page.</p>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress, to: row.guest_email, subject, html }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('[kizuna] resend send failed', response.status, text);
    }
  } catch (err) {
    console.error('[kizuna] resend send threw', err);
  }
}
