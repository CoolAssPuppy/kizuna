import { useTranslation } from 'react-i18next';

import { NavTile } from '@/components/NavTile';
import { useIsAdmin } from '@/features/auth/hooks';

import { ProfileAvatar } from './ProfileAvatar';

export function ProfileScreen(): JSX.Element {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-8 py-10">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <ProfileAvatar />
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
