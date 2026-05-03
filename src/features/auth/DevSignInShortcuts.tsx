import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { useAuth } from './AuthContext';

interface Props {
  disabled: boolean;
}

const DEV_PASSWORD = 'kizuna-dev-only';
const DEV_EMPLOYEE = 'luke.skywalker@kizuna.dev';
const DEV_ADMIN = 'jean-luc.picard@kizuna.dev';

/**
 * Two shortcut buttons that sign in as a seeded employee or admin so
 * QA can swap roles without juggling credentials.
 *
 * TEMPORARY: rendered unconditionally during the launch staging
 * window so sponsors and partners can poke around stg / prd without
 * a real Okta dance. Re-gate with `import.meta.env.DEV` before
 * cutting a real release; the gate lives at the call site
 * (SignInScreen.tsx) so this component stays simple.
 *
 * Falls back gracefully: if the seeded user does not exist (the sample
 * fixtures fixture has not been applied), surfaces an alert instead of
 * silently doing nothing.
 */
export function DevSignInShortcuts({ disabled }: Props): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signInWithPassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handlePretend(email: string): Promise<void> {
    setBusy(true);
    setErrorKey(null);
    try {
      await signInWithPassword(email, DEV_PASSWORD);
      navigate('/', { replace: true });
    } catch {
      setErrorKey('auth.errors.invalidCredentials');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-amber-900">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide">{t('auth.dev.header')}</p>
        <p className="text-xs">{t('auth.dev.subtitle')}</p>
      </header>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="default"
          onClick={() => void handlePretend(DEV_EMPLOYEE)}
          disabled={disabled || busy}
        >
          {t('auth.dev.asEmployee')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handlePretend(DEV_ADMIN)}
          disabled={disabled || busy}
        >
          {t('auth.dev.asAdmin')}
        </Button>
      </div>
      {errorKey ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}
