// Sponsor-payment fan-out: minors → paid, pending invitations → sent,
// invite email per newly-flipped invitation. Idempotent because the
// invitation update matches status='pending' only.

import { sendResendEmail } from './notify.ts';
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
  const acceptUrl = `${Deno.env.get('KIZUNA_PUBLIC_URL') ?? 'http://localhost:5173'}/accept-invitation?token=${encodeURIComponent(row.signed_token)}`;
  const firstName = row.full_name.split(' ')[0] ?? '';
  const html = `<p>Hi ${firstName},</p>
<p>Your fee has been paid and your seat is confirmed. <a href="${acceptUrl}">Accept your invitation</a> within 7 days.</p>
<p>If you forget your password later, use "Forgot password" on the sign-in page.</p>`;
  const ok = await sendResendEmail({
    to: row.guest_email,
    subject: "You're invited to Supafest",
    html,
  });
  if (!ok) console.error('[kizuna] sponsor fan-out: resend send failed for %s', row.guest_email);
}
