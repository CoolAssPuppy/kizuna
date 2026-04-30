import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function NotFound(): JSX.Element {
  const { t } = useTranslation();

  return (
    <main
      className="relative flex min-h-screen items-center justify-center p-6 text-white"
      style={{
        backgroundImage:
          'linear-gradient(rgba(10, 15, 30, 0.55), rgba(10, 15, 30, 0.85)), url(/backgrounds/404.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <section className="max-w-md space-y-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-base font-bold backdrop-blur-sm"
        >
          404
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">{t('errors.notFound.title')}</h1>
        <p className="text-base text-white/80">{t('errors.notFound.description')}</p>
        <Button asChild>
          <Link to="/">{t('errors.notFound.goHome')}</Link>
        </Button>
      </section>
    </main>
  );
}
