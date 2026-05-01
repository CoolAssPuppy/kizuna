/**
 * Pure helpers for the "Get to know your teammate" home card.
 *
 * Most fun_facts in attendee_profiles are written in the first person
 * ("I once played first chair in a Klingon opera."). The card asks
 * "Which teammate ${question}?", so we need to rephrase the first
 * person into a third-person predicate. Keeping this client-side and
 * deterministic means the card renders without any backend round-trip;
 * a future enhancement can route through a cheap edge-function using
 * gpt-4o-mini for stronger rephrasing, with this fallback for offline
 * mode.
 */

/**
 * Reframe a first-person fun_fact into a "Which teammate _____?"
 * predicate. The function is intentionally conservative — it never
 * fabricates content, only strips the leading "I" and normalises the
 * trailing punctuation. If the fact already reads as a third-person
 * statement we leave it unchanged.
 */
export function reframeAsTeammateQuestion(rawFact: string): string {
  const trimmed = rawFact.trim();
  if (!trimmed) return '';

  let body = trimmed;

  // "I've / I have / I'm / I'd" expansions first so they survive the
  // narrower "I " match below.
  body = body.replace(/^I'm\b/, 'is');
  body = body.replace(/^I am\b/i, 'is');
  body = body.replace(/^I've\b/, 'has');
  body = body.replace(/^I have\b/i, 'has');
  body = body.replace(/^I'd\b/, 'would');
  body = body.replace(/^I'll\b/, 'will');
  body = body.replace(/^I once\b/i, 'once');
  body = body.replace(/^I /, '');

  // Trim the trailing sentence punctuation so we can append our own ?.
  body = body.replace(/[.?!]+\s*$/, '').trim();

  // Lowercase the first letter so it reads naturally after "Which
  // teammate" — but only if the first character was already a word
  // character (preserve names like "Klingon" if they happen to start
  // the predicate).
  if (body.length > 0 && /[A-Z]/.test(body[0]!)) {
    body = body[0]!.toLowerCase() + body.slice(1);
  }

  return `Which teammate ${body}?`;
}

interface SeedablePerson {
  user_id: string;
  fun_fact: string | null;
}

/**
 * Pick a single teammate whose fun_fact is non-empty. Deterministic
 * given a seed so re-renders within the same render pass don't shuffle
 * the card.
 */
export function pickIcebreakerTarget<T extends SeedablePerson>(
  people: ReadonlyArray<T>,
  seed: number,
): T | null {
  const eligible = people.filter((p) => p.fun_fact && p.fun_fact.trim().length > 0);
  if (eligible.length === 0) return null;
  const index = Math.abs(Math.floor(seed)) % eligible.length;
  return eligible[index] ?? null;
}
