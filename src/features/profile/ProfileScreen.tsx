import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';

export function ProfileScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const localPart = user?.email.split('@')[0] ?? '';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-8 py-10">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('profile.title')}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {t('welcome.greeting', { name: localPart })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
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
