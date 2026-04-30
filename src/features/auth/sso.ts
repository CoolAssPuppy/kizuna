/**
 * Employee SSO entry point.
 *
 * Production: uses Supabase's Enterprise SSO path against the Okta domain
 * registered in the Supabase dashboard. The redirect flow returns to Supabase's
 * auth callback, which exchanges the SAML/OIDC response for a session.
 *
 * Local dev: Okta is absent, so this falls back to a deterministic dev sign-in
 * that uses the password grant against a seeded employee user. This is the
 * explicit "graceful degradation" pattern documented in CLAUDE.md.
 */

import type { AppSupabaseClient } from '@/lib/supabase';

const DEV_SSO_EMAIL = 'paul@kizuna.dev';
const DEV_SSO_PASSWORD = 'kizuna-dev-only';

interface SsoConfig {
  oktaDomain?: string | undefined;
  oktaClientId?: string | undefined;
}

export function isSsoConfigured(config: SsoConfig): boolean {
  return Boolean(config.oktaDomain && config.oktaClientId);
}

export async function signInWithSso(client: AppSupabaseClient, config: SsoConfig): Promise<void> {
  if (isSsoConfigured(config) && config.oktaDomain) {
    const { error } = await client.auth.signInWithSSO({
      domain: config.oktaDomain,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    // signInWithSSO triggers a full-page redirect; control does not return here.
    return;
  }

  // Dev fallback. Make the warning loud so it's never confused for production.
  console.warn(
    '[kizuna] SSO not configured — falling back to dev seed credentials. ' +
      'Set VITE_OKTA_DOMAIN and VITE_OKTA_CLIENT_ID to enable real SSO.',
  );

  const { error } = await client.auth.signInWithPassword({
    email: DEV_SSO_EMAIL,
    password: DEV_SSO_PASSWORD,
  });

  if (error) {
    throw new Error(
      'Dev SSO fallback failed. Ensure the seeded employee account exists with the ' +
        'expected dev password. Run `npm run db:apply` and confirm the seed completed.',
    );
  }
}
