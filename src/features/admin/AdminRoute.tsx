import { useTranslation } from 'react-i18next';

import { useIsAdmin } from '@/features/auth/hooks';

import { AdminScreen } from './AdminScreen';

export function AdminRoute(): JSX.Element {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {t('admin.blocked')}
        </p>
      </main>
    );
  }
  return <AdminScreen />;
}
