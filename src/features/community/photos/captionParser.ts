/**
 * Caption parsing helpers for the photo gallery.
 *
 * Hashtags follow the same regex the server-side trigger uses
 * (sync_event_photo_hashtags in 80_functions_and_triggers.sql), so the
 * client preview matches what eventually lands in event_photo_hashtags
 * after the server parses the caption.
 *
 * Mentions are an @-prefixed email pattern; the upload dialog converts
 * matching mentions into event_photo_tags rows server-side.
 */

const HASHTAG_RE = /#([A-Za-z0-9_]+)/g;
const MENTION_RE = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const HASHTAG_BODY_MIN = 1;
const HASHTAG_BODY_MAX = 64;

export type CaptionToken =
  | { kind: 'text'; value: string }
  | { kind: 'hashtag'; value: string }
  | { kind: 'mention'; value: string };

export function parseHashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const out = new Set<string>();
  for (const match of caption.matchAll(HASHTAG_RE)) {
    const body = match[1] ?? '';
    if (body.length < HASHTAG_BODY_MIN || body.length > HASHTAG_BODY_MAX) continue;
    out.add(body.toLowerCase());
  }
  return Array.from(out);
}

export function parseMentions(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const out = new Set<string>();
  for (const match of caption.matchAll(MENTION_RE)) {
    const email = match[1];
    if (email) out.add(email);
  }
  return Array.from(out);
}

interface RegexHit {
  kind: 'hashtag' | 'mention';
  value: string;
  start: number;
  end: number;
}

function collectHits(caption: string): RegexHit[] {
  const hits: RegexHit[] = [];
  for (const match of caption.matchAll(HASHTAG_RE)) {
    const body = match[1] ?? '';
    if (body.length < HASHTAG_BODY_MIN || body.length > HASHTAG_BODY_MAX) continue;
    if (typeof match.index !== 'number') continue;
    hits.push({
      kind: 'hashtag',
      value: body,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  for (const match of caption.matchAll(MENTION_RE)) {
    const email = match[1];
    if (!email || typeof match.index !== 'number') continue;
    hits.push({
      kind: 'mention',
      value: email,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

/**
 * Tokenise a caption into a sequence of text / hashtag / mention spans
 * for live caption highlighting in the upload dialog.
 */
export function captionTokens(caption: string): CaptionToken[] {
  if (!caption) return [];
  const hits = collectHits(caption);
  if (hits.length === 0) return [{ kind: 'text', value: caption }];

  const tokens: CaptionToken[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) {
      tokens.push({ kind: 'text', value: caption.slice(cursor, hit.start) });
    }
    tokens.push({ kind: hit.kind, value: hit.value });
    cursor = hit.end;
  }
  if (cursor < caption.length) {
    tokens.push({ kind: 'text', value: caption.slice(cursor) });
  }
  return tokens;
}
