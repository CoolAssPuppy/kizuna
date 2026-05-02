// Shared admin guard for edge functions.
//
// Reads the JWT from the request, hits Supabase Auth via a user-scoped
// client to resolve the caller's identity and `app_role` claim, returns
// 401 if the call is anonymous or 403 if the role is not admin.
// Returns the user's id on success so the caller can stamp `sent_by`,
// `generated_by`, etc.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { jsonResponse } from './cors.ts';
import { getUserClient } from './supabaseClient.ts';

export interface AdminCaller {
  userId: string;
  role: 'admin' | 'super_admin';
  client: SupabaseClient;
}

/**
 * Returns either an AdminCaller or a Response that the handler should
 * return verbatim. Pattern at the call site:
 *
 *   const guard = await requireAdmin(req);
 *   if (guard instanceof Response) return guard;
 *   const { userId } = guard;
 */
export async function requireAdmin(req: Request): Promise<AdminCaller | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  // Pass the JWT explicitly: edge runtime is stateless so the SDK has
  // no persisted session to read from. `getUser()` with no args throws
  // "Auth session missing!"; `getUser(jwt)` validates against GoTrue.
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  const userClient = getUserClient(authHeader);
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data.user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const role = (data.user.app_metadata as Record<string, unknown> | undefined)?.['app_role'];
  if (role !== 'admin' && role !== 'super_admin') {
    return jsonResponse({ error: 'forbidden' }, { status: 403 });
  }

  return { userId: data.user.id, role, client: userClient };
}
