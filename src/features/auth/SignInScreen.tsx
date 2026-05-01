import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { useAuth } from './AuthContext';
import { DevSignInShortcuts } from './DevSignInShortcuts';
import { hydrateFromHiBob } from './hibobHydrate';

type Tab = 'employee' | 'guest';
type Mode = 'sign-in' | 'sign-up';

interface LocationState {
  from?: string;
}

export function SignInScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithSso, signInWithPassword, signUpWithPassword } = useAuth();

  const [tab, setTab] = useState<Tab>('employee');
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';
  const redirectTo = (location.state as LocationState | null)?.from ?? '/';

  async function handleSso(): Promise<void> {
    setBusy(true);
    setErrorKey(null);
    try {
      await signInWithSso();
      // Pull preferred name / t-shirt size / department / etc. from
      // HiBob into the local profile so the wizard is pre-filled. The
      // helper swallows errors — registration still proceeds even if
      // HiBob is unreachable or the credentials are stubbed.
      await hydrateFromHiBob(getSupabaseClient());
      // Brand-new sign-ins land in the registration wizard. The wizard
      // is fully cancellable: users who want to skip it can navigate
      // anywhere and the same questions live on the Profile page.
      navigate('/registration', { replace: true });
    } catch {
      setErrorKey('auth.errors.generic');
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setErrorKey(null);

    if (isSignUp && password.length < 8) {
      setErrorKey('auth.errors.weakPassword');
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      navigate(redirectTo, { replace: true });
    } catch {
      setErrorKey('auth.errors.invalidCredentials');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-background/95 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.signInSubtitle')}</p>
        </header>

        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md border p-1">
          {(['employee', 'guest'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-sm font-medium',
                tab === value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
              )}
            >
              {value === 'employee' ? t('auth.employeeTab') : t('auth.guestTab')}
            </button>
          ))}
        </div>

        {tab === 'employee' ? (
          <div className="space-y-4">
            <Button onClick={() => void handleSso()} disabled={busy} className="w-full" size="lg">
              {t('auth.continueWithSso')}
            </Button>
            {/* TEMPORARY: dev shortcuts shown in prod for the launch
                staging window so a sponsor / partner can sanity-check
                the seeded data without juggling credentials. Re-gate
                with `import.meta.env.DEV` before we cut a real release. */}
            <DevSignInShortcuts disabled={busy} />
          </div>
        ) : (
          <form onSubmit={(event) => void handlePassword(event)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.needAccount')}{' '}
              <button
                type="button"
                onClick={() => setMode(isSignUp ? 'sign-in' : 'sign-up')}
                className="font-medium text-primary hover:underline"
              >
                {isSignUp ? t('auth.signIn') : t('auth.createAccount')}
              </button>
            </p>
          </form>
        )}

        {errorKey ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {t(errorKey)}
          </p>
        ) : null}
      </div>
    </main>
  );
}
