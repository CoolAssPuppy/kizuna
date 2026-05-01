/**
 * Pure helpers for the OpenAI itinerary-parser response shape.
 * Pulled out of openai.ts so they can be tested without mocking
 * fetch + the wrapper around the model call. The edge-function-side
 * mirror in supabase/functions/_shared/itineraryParser.ts has the
 * same pair (kept in sync by hand because the tree boundary
 * prevents a single import).
 */

/**
 * Strip the markdown code-fence GPT-4 family models sometimes wrap
 * around JSON output even with response_format=json_object set. Robust
 * to leading/trailing whitespace and an optional `json` language tag.
 */
export function stripJsonCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/**
 * Coerce empty-string field values to null. Models occasionally emit
 * "" instead of null for missing fields, which then trips downstream
 * schema CHECKs (e.g. flight.departure_airport length=3). Caller
 * passes one row-list per top-level group.
 */
export function nullifyEmptyStrings<T>(rows: ReadonlyArray<T>): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const key of Object.keys(out)) {
      const value = out[key];
      if (typeof value === 'string' && value.trim() === '') out[key] = null;
    }
    return out as T;
  });
}
