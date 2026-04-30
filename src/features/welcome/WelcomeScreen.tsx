import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';

import { backgroundFor, fallbackGradientFor, timeOfDay } from './timeOfDay';

export function WelcomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  const period = useMemo(() => timeOfDay(), []);
  const backgroundUrl = useMemo(() => backgroundFor(period), [period]);
  const fallbackGradient = useMemo(() => fallbackGradientFor(period), [period]);

  const greetingName = user?.email.split('@')[0] ?? '';

  return (
    <main
      className="relative flex min-h-screen items-center justify-center p-6 text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 15, 30, 0.55), rgba(10, 15, 30, 0.85)), url(${backgroundUrl}), ${fallbackGradient}`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <section className="max-w-xl space-y-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold backdrop-blur-sm"
        >
          絆
        </span>
        {user ? (
          <>
            <h1 className="text-5xl font-semibold tracking-tight">
              {t('welcome.greeting', { name: greetingName })}
            </h1>
            <p className="text-lg text-white/80">{t('app.tagline')}</p>
            <Link
              to="/profile"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('profile.title')}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-semibold tracking-tight">{t('app.name')}</h1>
            <p className="text-lg text-white/80">{t('app.tagline')}</p>
            <Link
              to="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('auth.signIn')}
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
