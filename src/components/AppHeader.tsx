import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';

import { UserAvatar } from './UserAvatar';

export function AppHeader(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-8 py-3">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background"
            style={{ fontFamily: 'system-ui', fontWeight: 700, fontSize: 14 }}
          >
            絆
          </span>
          <span className="text-sm font-semibold">{t('app.name')}</span>
        </Link>

        {user ? <UserAvatar /> : null}
      </div>
    </header>
  );
}
