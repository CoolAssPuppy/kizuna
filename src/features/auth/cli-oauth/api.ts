import { getSupabaseClient } from '@/lib/supabase';

import type { ApiKeyScope } from '@/features/profile/api-keys/types';

export interface OauthAuthorizeRequest {
  scope: ApiKeyScope;
  state: string;
  redirect: string;
}

/** Mints a short-lived (60s) authorization code bound to the caller. */
export async function mintOauthCode(input: OauthAuthorizeRequest): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('mint_oauth_code', {
    p_scope: input.scope,
    p_state: input.state,
    p_redirect: input.redirect,
  });
  if (error) throw error;
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('mint_oauth_code returned an empty code.');
  }
  return data;
}
