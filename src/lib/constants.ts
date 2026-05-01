// Browser-side mirror of `supabase/functions/_shared/constants.ts`.
// Each runtime keeps its own copy because the Deno edge functions cannot
// import from src/. Keep these in sync when a window changes.

/** Cooldown between nudges for the same registration_task. */
export const NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/** Lifetime of a guest invitation token (signed JWT). */
export const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;
