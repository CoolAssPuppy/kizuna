// /cli/oauth-callback — receives the authorization code in Kizuna
// chrome (so the look and feel matches the host app), POSTs the code
// to the local agent's loopback redirect URI, then renders a success
// state. If the loopback POST fails (port closed, agent crashed, user
// pasted into a different machine) we surface a manual fallback that
// shows the code so the agent can paste it into a terminal.

import { CheckCircle2, Copy, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/hooks/useMountEffect';

type Phase = 'pending' | 'delivered' | 'manual';

export function CallbackScreen(): JSX.Element {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('pending');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    const code = params.get('code');
    const state = params.get('state');
    const redirect = params.get('redirect');
    if (!code || !state || !redirect) return null;
    return { code, state, redirect };
  }, [params]);

  useMountEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    void deliverCode(parsed.code, parsed.state, parsed.redirect)
      .then(() => {
        if (cancelled) return;
        setPhase('delivered');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPhase('manual');
        setError(err instanceof Error ? err.message : t('cliOauth.callback.deliverFailed'));
      });
    return () => {
      cancelled = true;
    };
  });

  if (!parsed) {
    return (
      <main className="mx-auto w-full max-w-2xl px-8 py-10">
        <CardShell title={t('cliOauth.callback.title')}>
          <p className="text-sm text-destructive">{t('cliOauth.callback.malformed')}</p>
        </CardShell>
      </main>
    );
  }

  const onCopy = (): void => {
    void navigator.clipboard.writeText(parsed.code).then(() => setCopied(true));
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-8 py-10">
      <CardShell title={t('cliOauth.callback.title')}>
        {phase === 'pending' ? (
          <p className="text-sm text-muted-foreground">{t('cliOauth.callback.delivering')}</p>
        ) : phase === 'delivered' ? (
          <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
            <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm">{t('cliOauth.callback.success')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
              <Terminal aria-hidden className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="space-y-2 text-sm">
                <p>{t('cliOauth.callback.fallback')}</p>
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                <pre className="overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
                  npx kizuna login --paste {parsed.code}
                </pre>
                <p className="text-xs text-muted-foreground">
                  {t('cliOauth.callback.codeLabel')}{' '}
                  <code className="font-mono">{parsed.code}</code>
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="ghost" onClick={onCopy}>
                <Copy aria-hidden />
                {copied ? t('cliOauth.callback.copied') : t('cliOauth.callback.copy')}
              </Button>
            </div>
          </div>
        )}
      </CardShell>
    </main>
  );
}

async function deliverCode(code: string, state: string, redirect: string): Promise<void> {
  const url = new URL(redirect);
  // Local agents bind on http; we hand them only the code+state body.
  const response = await fetch(url.toString(), {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!response.ok) {
    throw new Error(`Local agent responded ${response.status}`);
  }
}
