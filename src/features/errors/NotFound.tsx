import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function NotFound(): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold">{t('errors.notFound.title')}</h1>
        <p className="text-muted-foreground">{t('errors.notFound.description')}</p>
        <Button asChild>
          <Link to="/">{t('errors.notFound.goHome')}</Link>
        </Button>
      </section>
    </main>
  );
}
