// Sponsor-payment fan-out: minors → paid, pending invitations → sent,
// invite email per newly-flipped invitation. Idempotent because the
// invitation update matches status='pending' only.

import { publicUrl } from './env.ts';
import { sendResendEmail } from './notify.ts';
import { getAdminClient } from './supabaseClient.ts';

interface InvitationRow {
  id: string;
  full_name: string;
  guest_email: string;
  signed_token: string;
}

export async function dispatchSponsorPaymentSucceeded(
  sponsorUserId: string,
): Promise<void> {
  const admin = getAdminClient();

  // Atomic flip with RETURNING — one round-trip, no TOCTOU window
  // where a parallel webhook could re-read the same pending rows
  // and double-email. Minors update is independent so parallelise.
  const [, invitationsResp] = await Promise.all([
    admin
      .from('additional_guests')
      .update({ payment_status: 'paid' })
      .eq('sponsor_id', sponsorUserId)
      .eq('payment_status', 'pending'),
    admin
      .from('guest_invitations')
      .update({ status: 'sent' })
      .eq('sponsor_id', sponsorUserId)
      .eq('status', 'pending')
      .select('id, full_name, guest_email, signed_token'),
  ]);

  if (invitationsResp.error) {
    console.error('[kizuna] sponsor fan-out: invitations flip failed', invitationsResp.error);
    return;
  }
  const flipped = (invitationsResp.data ?? []) as InvitationRow[];
  if (flipped.length === 0) return;

  // Email failures don't roll back the status flip — the row is in
  // 'sent' and an admin can re-trigger manually if Resend was down.
  await Promise.all(flipped.map((row) => sendInviteEmail(row)));
}

async function sendInviteEmail(row: InvitationRow): Promise<void> {
  const acceptUrl = `${publicUrl()}/accept-invitation?token=${encodeURIComponent(row.signed_token)}`;
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
