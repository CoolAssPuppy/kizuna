import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/', i18nKey: 'nav.home' },
  { to: '/itinerary', i18nKey: 'nav.itinerary' },
  { to: '/agenda', i18nKey: 'nav.agenda' },
  { to: '/documents', i18nKey: 'nav.documents' },
  { to: '/community', i18nKey: 'nav.community' },
] as const;

/**
 * Hamburger menu shown below the md breakpoint. Uses the same link
 * list as HeaderNav so adding a route updates both surfaces. The
 * panel anchors to the top of the viewport because the header itself
 * is sticky-ish and a dropdown anchored to the button gets clipped on
 * narrow phones.
 */
export function MobileNav(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Close on click outside the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Defer attaching so the click that opened the menu doesn't immediately close it.
    const id = window.setTimeout(() => window.addEventListener('mousedown', onClick), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={t(open ? 'nav.closeMenu' : 'nav.openMenu')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
      </button>
      {open ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 top-[57px] z-40 bg-background/40 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('nav.menu')}
            className="fixed inset-x-0 top-[57px] z-50 border-b bg-background shadow-lg"
          >
            <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-3">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-base transition-colors',
                      isActive
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {t(link.i18nKey)}
                </NavLink>
              ))}
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
