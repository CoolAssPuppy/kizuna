// Shared business policy constants for edge functions.
// Mirror of `src/lib/constants.ts` (browser side); keep these in sync.

/** Cooldown between nudges for the same registration_task. */
export const NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/** Window before reg_closes_at when deadline reminders fire. */
export const REMINDER_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/** Lifetime of a guest invitation token (signed JWT). */
export const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Default lifetime of a shareable report link. */
export const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
