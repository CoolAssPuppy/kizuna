import type { Database } from '@/types/database.types';

export type GuestInvitationRow = Database['public']['Tables']['guest_invitations']['Row'];
export type GuestProfileRow = Database['public']['Tables']['guest_profiles']['Row'];
export type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];
export type GuestInvitationStatus = GuestInvitationRow['status'];
export type GuestAgeBracket = Database['public']['Enums']['guest_age_bracket'];

/** Launch-tier prices, kept in sync with public.guest_fee_for_bracket(). */
export const GUEST_FEE_FOR_BRACKET: Record<GuestAgeBracket, number> = {
  under_12: 200,
  teen: 500,
  adult: 950,
};
