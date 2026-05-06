import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTE_MANIFEST } from '@/app/routeManifest.generated';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useIsAdmin } from '@/features/auth/hooks';
import { useMountEffect } from '@/hooks/useMountEffect';

export function CommandPalette(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);

  useMountEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const routes = useMemo(
    () =>
      ROUTE_MANIFEST.filter((route) => {
        const scope = 'scope' in route ? route.scope : undefined;
        return scope !== 'admin' || isAdmin;
      }),
    [isAdmin],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0">
        <DialogTitle className="sr-only">{t('palette.title')}</DialogTitle>
        <Command shouldFilter>
          <div className="flex items-center gap-2 border-b px-3 py-3">
            <Search aria-hidden className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              placeholder={t('palette.placeholder')}
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t('palette.empty')}
          </Command.Empty>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {routes.map((route) => (
              <Command.Item
                key={route.path}
                value={`${t(route.labelKey)} ${route.path} ${route.keywords.join(' ')}`}
                onSelect={() => {
                  navigate(route.path);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <span>{t(route.labelKey)}</span>
                <span className="font-mono text-xs text-muted-foreground">{route.path}</span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
