// /cli/oauth-authorize — the consent screen an MCP server or CLI sends
// the user to. Reads the requested scope, state, and loopback redirect
// from the URL, renders an "Allow / Deny" decision, then mints a
// short-lived OAuth code and bounces to /cli/oauth-callback. The code
// is never exposed to the redirect_uri until the callback runs in
// Kizuna chrome.

import { ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';
import type { ApiKeyScope } from '@/features/profile/api-keys/types';

import { mintOauthCode } from './api';

const ALLOWED_SCOPES: ApiKeyScope[] = ['read', 'write', 'admin'];

export function AuthorizeScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requested = useMemo(() => parseRequest(params), [params]);

  if (!user) {
    // RequireAuth in router.tsx guards this route, so this is just a
    // belt-and-braces render guard.
    return <p>{t('app.loading')}</p>;
  }

  if (!requested) {
    return (
      <main className="mx-auto w-full max-w-2xl px-8 py-10">
        <CardShell title={t('cliOauth.authorize.title')}>
          <p className="text-sm text-destructive">{t('cliOauth.authorize.malformed')}</p>
        </CardShell>
      </main>
    );
  }

  const scopeLabelKey = `profile.apiKeys.scope.${requested.scope}` as const;
  const adminBlocked = requested.scope === 'admin' && !isAdmin;

  const onAuthorize = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const code = await mintOauthCode({
        scope: requested.scope,
        state: requested.state,
        redirect: requested.redirect,
      });
      navigate(
        `/cli/oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(requested.state)}&redirect=${encodeURIComponent(requested.redirect)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cliOauth.authorize.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const onDeny = (): void => {
    navigate('/');
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-8 py-10">
      <CardShell
        title={t('cliOauth.authorize.title')}
        description={t('cliOauth.authorize.subtitle', { client: requested.clientName })}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
            <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 text-primary" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                {t('cliOauth.authorize.scopeLine', {
                  scope: t(scopeLabelKey),
                })}
              </p>
              <p className="text-muted-foreground">
                {t(`cliOauth.authorize.scopeBlurb.${requested.scope}`)}
              </p>
              <p className="font-mono text-xs text-muted-foreground">{requested.redirect}</p>
            </div>
          </div>

          {adminBlocked ? (
            <p className="text-sm text-destructive">{t('cliOauth.authorize.adminBlocked')}</p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onDeny}>
              <X aria-hidden />
              {t('cliOauth.authorize.deny')}
            </Button>
            <Button
              type="button"
              onClick={() => void onAuthorize()}
              disabled={busy || adminBlocked}
            >
              {busy ? t('cliOauth.authorize.allowing') : t('cliOauth.authorize.allow')}
            </Button>
          </div>
        </div>
      </CardShell>
    </main>
  );
}

interface ParsedRequest {
  scope: ApiKeyScope;
  state: string;
  redirect: string;
  clientName: string;
}

function parseRequest(params: URLSearchParams): ParsedRequest | null {
  const scope = params.get('scope');
  const state = params.get('state');
  const redirect = params.get('redirect');
  const clientName = params.get('client') ?? 'Unknown agent';
  if (!scope || !state || !redirect) return null;
  if (!ALLOWED_SCOPES.includes(scope as ApiKeyScope)) return null;
  if (!isLoopbackRedirect(redirect)) return null;
  return { scope: scope as ApiKeyScope, state, redirect, clientName };
}

/**
 * Loopback redirects only — agents must bind a local port to receive
 * the code. This blocks open-redirect abuse: an attacker cannot send
 * the user to a phishing site by passing a remote URL.
 */
function isLoopbackRedirect(redirect: string): boolean {
  try {
    const url = new URL(redirect);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
