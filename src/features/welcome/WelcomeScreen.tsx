import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';

import { backgroundFor, timeOfDay } from './timeOfDay';

export function WelcomeScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const backgroundUrl = useMemo(() => backgroundFor(timeOfDay()), []);

  if (!user) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center p-6 text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(10, 15, 30, 0.55), rgba(10, 15, 30, 0.85)), url(${backgroundUrl}), linear-gradient(135deg, #1a3a52, #2c5d72, #4a8095)`,
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
          <h1 className="text-5xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="text-lg text-white/80">{t('app.tagline')}</p>
          <Link
            to="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('auth.signIn')}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-8 py-10">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('app.tagline')}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {t('welcome.greeting', { name: user.email.split('@')[0] })}
        </h1>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NavTile
          to="/registration"
          title={t('nav.registration')}
          description={t('welcome.tiles.registration')}
        />
        <NavTile
          to="/itinerary"
          title={t('nav.itinerary')}
          description={t('welcome.tiles.itinerary')}
        />
        <NavTile
          to="/documents"
          title={t('nav.documents')}
          description={t('welcome.tiles.documents')}
        />
        <NavTile
          to="/consent"
          title={t('welcome.tiles.consentTitle')}
          description={t('welcome.tiles.consent')}
        />
        {isAdmin ? (
          <NavTile
            to="/admin"
            title={t('nav.admin')}
            description={t('welcome.tiles.admin')}
            highlight
          />
        ) : null}
      </section>
    </main>
  );
}

interface NavTileProps {
  to: string;
  title: string;
  description: string;
  highlight?: boolean;
}

function NavTile({ to, title, description, highlight = false }: NavTileProps): JSX.Element {
  return (
    <Link
      to={to}
      className={
        'group flex flex-col gap-2 rounded-xl border p-6 transition-colors hover:bg-accent ' +
        (highlight ? 'border-primary/40 bg-primary/5' : 'bg-card')
      }
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
