import type { AdditionalGuestRow, GuestInvitationRow } from '@/features/guests/types';

/**
 * Sum of every fee_amount the sponsor will be charged for: pending +
 * accepted adult invitations plus every minor on the registration.
 * Cancelled invitations come off the total.
 *
 * Pure: takes plain rows, returns a number. The display layer wraps
 * it with currency formatting.
 */
export function computeGuestFeeTotal(
  invitations: ReadonlyArray<GuestInvitationRow>,
  minors: ReadonlyArray<AdditionalGuestRow>,
): number {
  return (
    invitations
      .filter((i) => i.status !== 'cancelled')
      .reduce((sum, i) => sum + Number(i.fee_amount), 0) +
    minors.reduce((sum, m) => sum + Number(m.fee_amount), 0)
  );
}
