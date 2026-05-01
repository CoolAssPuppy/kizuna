import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';

import { acceptGuestInvitation } from './api';

type State = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; messageKey: string };

export function AcceptInvitationScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signInWithPassword } = useAuth();

  const token = params.get('token');
  const sponsor = params.get('sponsor') ?? 'your sponsor';
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const tokenMissing = useMemo(() => token === null || token.length === 0, [token]);

  useEffect(() => {
    if (tokenMissing) {
      setState({ kind: 'error', messageKey: 'guests.errors.missingToken' });
    }
  }, [tokenMissing]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setState({ kind: 'error', messageKey: 'auth.errors.weakPassword' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const result = await acceptGuestInvitation(
        { client: getSupabaseClient() },
        {
          token,
          password,
        },
      );
      // Sign the guest in directly so they land on the registration wizard
      // already authenticated.
      await signInWithPassword(result.guestEmail, password);
      navigate('/registration', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const key = message.includes('expired')
        ? 'guests.errors.expired'
        : message.includes('signature')
          ? 'guests.errors.badSignature'
          : 'guests.errors.generic';
      setState({ kind: 'error', messageKey: key });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-background/95 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('guests.invitationTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('guests.invitationSubtitle', { sponsor })}
          </p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="guest-password">{t('guests.createPassword')}</Label>
            <Input
              id="guest-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={tokenMissing}
            />
            <p className="text-xs text-muted-foreground">{t('guests.passwordHint')}</p>
          </div>

          <Button
            type="submit"
            disabled={state.kind === 'submitting' || tokenMissing}
            size="lg"
            className="w-full"
          >
            {state.kind === 'submitting' ? t('guests.accepting') : t('guests.acceptAndContinue')}
          </Button>
        </form>

        {state.kind === 'error' ? (
          <p role="alert" className="text-sm text-destructive">
            {t(state.messageKey, { sponsor })}
          </p>
        ) : null}
      </div>
    </main>
  );
}
