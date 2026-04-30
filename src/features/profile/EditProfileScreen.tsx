import { useTranslation } from 'react-i18next';

export function EditProfileScreen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t('profile.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.comingSoon')}</p>
      </div>
    </main>
  );
}
