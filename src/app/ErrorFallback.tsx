import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  onReload: () => void;
}

export function ErrorFallback({ onReload }: ErrorFallbackProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">{t('errors.boundary.title')}</h1>
        <p className="text-muted-foreground">{t('errors.boundary.description')}</p>
        <Button onClick={onReload}>{t('errors.boundary.reload')}</Button>
      </div>
    </main>
  );
}
