import { useAuth } from '@/features/auth/AuthContext';
import { NotificationBell } from '@/features/notifications/NotificationBell';

import { HeaderBrand } from './HeaderBrand';
import { HeaderNav } from './HeaderNav';
import { HeaderUserMenu } from './HeaderUserMenu';

export function AppHeader(): JSX.Element {
  const { user } = useAuth();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-8 py-3">
        <HeaderBrand />
        {user ? <HeaderNav /> : null}
        <div className="flex items-center gap-1">
          {user ? <NotificationBell /> : null}
          <HeaderUserMenu />
        </div>
      </div>
    </header>
  );
}
