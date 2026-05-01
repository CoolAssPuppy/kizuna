// Error reporter shim. Phase 1 routes everything to the console; when
// Sentry (or equivalent) lands, this is the only place that changes.

export interface ErrorContext {
  source: string;
  [key: string]: unknown;
}

export function reportError(error: unknown, context: ErrorContext): void {
  console.error(`[kizuna:${context.source}]`, error, context);
}
