import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useOnlineStatus } from '@/lib/useOnlineStatus';

export function OfflineBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <CloudOff aria-hidden className="h-3.5 w-3.5" />
      <span>{t('app.offline')}</span>
    </div>
  );
}
