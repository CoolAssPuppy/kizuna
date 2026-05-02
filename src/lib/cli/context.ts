// Portable command context. This file is imported by both the Vite
// frontend (footer terminal) and the Supabase edge function (HTTP +
// MCP surfaces), so it must not depend on `@/` path aliases or any
// Vite-only modules. Type imports from `@supabase/supabase-js` and
// the generated database types are resolved via Deno's import map for
// the edge function (see supabase/functions/deno.json).

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../types/database.types.ts';

export type CommandRole = 'attendee' | 'admin' | 'super_admin';

export type CliPatScope = 'read' | 'write' | 'admin';

export type CliDbRole = 'employee' | 'guest' | 'admin' | 'super_admin' | 'dependent';

export interface CliUser {
  readonly id: string;
  readonly email: string;
  readonly role: CliDbRole;
}

/**
 * The translation function the registry calls. Compatible with
 * i18next's TFunction at the call site so the frontend can pass `t`
 * directly. The edge function passes a stub that echoes the key.
 */
export type CliTranslate = (key: string, vars?: Record<string, unknown>) => string;

export interface CommandContext {
  readonly supabase: SupabaseClient<Database>;
  readonly user: CliUser;
  readonly role: CommandRole;
  /** PAT scope when invoked over HTTP/MCP; null for the in-app footer. */
  readonly patScope: CliPatScope | null;
  readonly t: CliTranslate;
  readonly signal: AbortSignal;
}
