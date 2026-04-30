import type { Database } from '@/types/database.types';

export type GuestInvitationRow = Database['public']['Tables']['guest_invitations']['Row'];
export type GuestProfileRow = Database['public']['Tables']['guest_profiles']['Row'];
export type GuestInvitationStatus = GuestInvitationRow['status'];
