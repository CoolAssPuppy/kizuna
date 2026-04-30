import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { useAuth } from './AuthContext';
import { DevSignInShortcuts } from './DevSignInShortcuts';

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
      navigate(redirectTo, { replace: true });
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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
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
            {import.meta.env.DEV ? <DevSignInShortcuts disabled={busy} /> : null}
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
