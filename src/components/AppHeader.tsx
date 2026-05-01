import { useAuth } from '@/features/auth/AuthContext';
import { NotificationBell } from '@/features/notifications/NotificationBell';

import { HeaderBrand } from './HeaderBrand';
import { HeaderNav } from './HeaderNav';
import { HeaderUserMenu } from './HeaderUserMenu';
import { MobileNav } from './MobileNav';

export function AppHeader(): JSX.Element {
  const { user } = useAuth();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-8">
        <HeaderBrand />
        {user ? <HeaderNav /> : null}
        <div className="flex items-center gap-1">
          {user ? <NotificationBell /> : null}
          <HeaderUserMenu />
          {user ? <MobileNav /> : null}
        </div>
      </div>
    </header>
  );
}
