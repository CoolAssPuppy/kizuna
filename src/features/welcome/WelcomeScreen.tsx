import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';

export function WelcomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="text-lg text-muted-foreground">{t('app.tagline')}</p>
        {user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('auth.signedInAs', { email: user.email })}
            </p>
            <Button variant="outline" onClick={() => void signOut()}>
              {t('auth.signOut')}
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
