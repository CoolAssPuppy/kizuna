// Rephrases a first-person fun fact into a "Which teammate ___?"
// icebreaker question via gpt-4o-mini. Auth-gated, size-capped, and
// cached in public.icebreaker_rephrasings — a true cache miss is the
// only thing that spends an OpenAI token. The SPA has a local
// heuristic fallback so callers can ignore failures.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient, getUserClient } from '../_shared/supabaseClient.ts';

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

  // Require a valid Supabase JWT before we burn an OpenAI token or
  // touch the cache. Without this an anonymous caller can submit
  // arbitrary facts, drive cost, and pollute icebreaker_rephrasings.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthenticated' }, { status: 401 });
  }
  const userClient = getUserClient(authHeader);
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  if (userError || !userResult.user) {
    return jsonResponse({ error: 'unauthenticated' }, { status: 401 });
  }

  // Hard cap: a fact is one short sentence. 2KB is generous and keeps an
  // attacker from forcing a full GPT prompt window of work. (F007)
  const contentLength = Number(req.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 2 * 1024) {
    return jsonResponse({ error: 'payload_too_large' }, { status: 413 });
  }

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

  const factKey = normaliseFactKey(fact);
  const admin = getAdminClient();

  // 1) Cache lookup. Every successful rephrase has been persisted, so a
  //    second sighting of the same fact never spends an OpenAI token.
  const cacheRead = await admin
    .from('icebreaker_rephrasings')
    .select('question')
    .eq('fact_key', factKey)
    .maybeSingle();
  if (cacheRead.data?.question) {
    return jsonResponse({ question: cacheRead.data.question, source: 'cache' });
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
    const question = normalise(raw);

    // 2) Persist for the next caller. Best-effort: a write failure
    //    doesn't break this response — we still hand the question
    //    back to the SPA. Conflicts (someone wrote the same key
    //    between our read and write) get swallowed by upsert.
    await admin
      .from('icebreaker_rephrasings')
      .upsert(
        {
          fact_key: factKey,
          fact_original: fact,
          question,
          model,
        },
        { onConflict: 'fact_key' },
      );

    return jsonResponse({ question, source: 'live' });
  } catch (err) {
    console.warn('[rephrase-icebreaker] error, falling back', err);
    return jsonResponse({ question: localFallback(fact), source: 'fallback' });
  }
});

/**
 * Normalise a fact for cache lookup: lowercase, collapse internal
 * whitespace, trim, drop trailing sentence punctuation. Keeps the
 * cache hit-rate high across "I love chess.", "I love chess",
 * "  i love chess  ".
 */
function normaliseFactKey(rawFact: string): string {
  return rawFact
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+\s*$/, '')
    .trim();
}

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
