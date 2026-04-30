/**
 * Shared types for integration wrappers.
 *
 * Every integration module exports a "live or stubbed" implementation:
 *   - When credentials are present, the live client is used.
 *   - When credentials are missing, a stub returns deterministic mock data,
 *     logs a single "not configured" warning at module load, and never throws.
 *
 * This lets the entire app run locally without third-party setup, per
 * CLAUDE.md.
 */

export type IntegrationMode = 'live' | 'stubbed';

export interface IntegrationStatus {
  mode: IntegrationMode;
  reason?: string;
}
