/**
 * Error reporting shim.
 *
 * Phase 1 ships without a hosted error tracker. Calls to `reportError`
 * land in the browser console with structured context so we have a
 * consistent call shape; when Sentry (or equivalent) is wired up, this
 * file is the only place that needs to change. The shim being a real
 * function keeps the rest of the codebase from sprouting `// TODO sentry`
 * comments at every catch.
 */

export interface ErrorContext {
  source: string;
  [key: string]: unknown;
}

export function reportError(error: unknown, context: ErrorContext): void {
  // Console only for now. Errors reported here are surfaced to the user
  // via toast / fallback UI separately — this is the audit trail.
  console.error(`[kizuna:${context.source}]`, error, context);
}
