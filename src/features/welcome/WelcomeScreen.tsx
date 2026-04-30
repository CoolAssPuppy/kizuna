import { useTranslation } from 'react-i18next';

export function WelcomeScreen(): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="text-lg text-muted-foreground">{t('app.tagline')}</p>
      </section>
    </main>
  );
}
