// Edge function: rephrase-icebreaker
//
// Takes a first-person fun_fact ("I once played first chair in a
// Klingon opera.") and returns a polished "Which teammate ___?"
// question via gpt-4o-mini. The SPA already has a local heuristic
// fallback (see src/features/home/icebreaker.ts -> reframeAsTeammate
// Question) so callers can ignore failures.
//
// Stubbed mode (OPENAI_API_KEY missing) returns the deterministic
// local rephrasing — same output as the SPA fallback. This lets us
// run the full flow in dev without an OpenAI key and gives a
// graceful no-op when the key rotates or the model is unavailable.
//
// We deliberately use gpt-4o-mini at temperature 0 with a short
// system prompt; the rephrase is one sentence, so anything bigger
// is a waste of tokens.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';

declare const Deno: { env: { get: (k: string) => string | undefined } };

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You rephrase a first-person fun fact into a "Which teammate ___?" question for a corporate-retreat icebreaker. Rules:
- Output exactly one sentence ending with a question mark.
- Start with "Which teammate ".
- Strip "I", "I've", "I'd", "I am" and use third-person ("has", "is", "would").
- Keep the tone playful but professional.
- Do not invent facts or add commentary. Output ONLY the question.`;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let body: { fact?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400 });
  }

  const fact = body.fact?.trim();
  if (!fact || fact.length < 3) {
    return jsonResponse({ error: 'invalid_fact' }, { status: 400 });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.warn('[rephrase-icebreaker] OPENAI_API_KEY missing — returning local heuristic');
    return jsonResponse({ question: localFallback(fact), source: 'stub' });
  }

  try {
    const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL;
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 80,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: fact },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.warn('[rephrase-icebreaker] openai non-2xx, falling back', response.status, detail);
      return jsonResponse({ question: localFallback(fact), source: 'fallback' });
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return jsonResponse({ question: localFallback(fact), source: 'fallback' });
    }
    return jsonResponse({ question: normalise(raw), source: 'live' });
  } catch (err) {
    console.warn('[rephrase-icebreaker] error, falling back', err);
    return jsonResponse({ question: localFallback(fact), source: 'fallback' });
  }
});

/**
 * Mirror of src/features/home/icebreaker.ts -> reframeAsTeammateQuestion
 * so the offline path returns the same shape as the SPA already
 * displays. Kept inline (rather than imported) because edge functions
 * run in Deno and the SPA helper lives in the Vite tree.
 */
function localFallback(rawFact: string): string {
  let body = rawFact.trim();
  body = body.replace(/^I'm\b/, 'is');
  body = body.replace(/^I am\b/i, 'is');
  body = body.replace(/^I've\b/, 'has');
  body = body.replace(/^I have\b/i, 'has');
  body = body.replace(/^I'd\b/, 'would');
  body = body.replace(/^I'll\b/, 'will');
  body = body.replace(/^I once\b/i, 'once');
  body = body.replace(/^I /, '');
  body = body.replace(/[.?!]+\s*$/, '').trim();
  if (body.length > 0 && /[A-Z]/.test(body[0]!)) {
    body = body[0]!.toLowerCase() + body.slice(1);
  }
  return `Which teammate ${body}?`;
}

/**
 * Trim incidental wrapping the model sometimes adds: surrounding
 * quotes, a leading/trailing newline, or a stray "Question:" prefix.
 */
function normalise(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^Question:\s*/i, '');
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  return s;
}
