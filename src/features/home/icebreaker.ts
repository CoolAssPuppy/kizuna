/**
 * Pure helpers for the "Get to know your teammate" home card.
 *
 * Most fun_facts in attendee_profiles are written in the first person
 * ("I once played first chair in a Klingon opera."). The card asks
 * "Which teammate ${question}?", so we need to rephrase the first
 * person into a third-person predicate.
 *
 * Two paths:
 *   - reframeAsTeammateQuestion (here): pure, deterministic, runs
 *     instantly with no network. Used as the initial render and as
 *     the fallback when the live path errors.
 *   - rephrase-icebreaker edge function: routes the same fact through
 *     gpt-4o-mini for cleaner grammar. Triggered by rephraseTeammateQuestion
 *     below; the result swaps in once it arrives.
 */

import { callEdgeFunction } from '@/lib/edgeFunction';
import type { AppSupabaseClient } from '@/lib/supabase';

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

interface RephraseResult {
  question: string;
  source: 'live' | 'stub' | 'fallback';
}

/**
 * Hit the rephrase-icebreaker edge function for an OpenAI-polished
 * "Which teammate ___?" question. The component already renders the
 * local-heuristic version; this swap-in upgrades it once the model
 * responds. Failures resolve to the local heuristic so we never break
 * the card's UX.
 */
export async function rephraseTeammateQuestion(
  client: AppSupabaseClient,
  fact: string,
): Promise<string> {
  try {
    const result = await callEdgeFunction<RephraseResult>(client, 'rephrase-icebreaker', {
      fact,
    });
    return result.question;
  } catch (err) {
    console.warn('[icebreaker] rephrase failed, using local heuristic', err);
    return reframeAsTeammateQuestion(fact);
  }
}
