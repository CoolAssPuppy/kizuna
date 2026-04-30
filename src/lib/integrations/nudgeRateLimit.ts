/**
 * Spec: at most one nudge per task per three days per user.
 *
 * Pure function: given the task's `last_nudge_at`, returns whether
 * another nudge is allowed right now. Used both at edge-function call
 * sites and in the admin UI to render disabled/enabled state on
 * "send nudge" buttons.
 */

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export interface NudgeRateLimitInput {
  lastNudgeAtIso: string | null;
  /** Override clock for tests. */
  now?: Date;
  /** Override window length for tests. */
  windowMs?: number;
}

export function canSendNudge({ lastNudgeAtIso, now, windowMs }: NudgeRateLimitInput): boolean {
  if (lastNudgeAtIso === null) return true;
  const last = new Date(lastNudgeAtIso).getTime();
  if (Number.isNaN(last)) return true;
  const cutoff = (now ?? new Date()).getTime() - (windowMs ?? THREE_DAYS_MS);
  return last <= cutoff;
}

export function nextEligibleAt(
  lastNudgeAtIso: string | null,
  windowMs = THREE_DAYS_MS,
): Date | null {
  if (lastNudgeAtIso === null) return null;
  const last = new Date(lastNudgeAtIso);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + windowMs);
}
