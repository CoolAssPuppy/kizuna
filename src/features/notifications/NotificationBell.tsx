import { Bell } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { cn } from '@/lib/utils';

import type { NotificationRow } from './api';
import { useNotifications } from './useNotifications';

function formatRelative(iso: string, locale?: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 1)
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'minute');
  if (minutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-minutes, 'minute');
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-hours, 'hour');
  }
  const days = Math.round(hours / 24);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
}

export function NotificationBell(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={t('notifications.toggle', { count: unreadCount })}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell aria-hidden className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <DismissableDropdown
          containerRef={containerRef}
          onDismiss={() => setOpen(false)}
          ariaLabel={t('notifications.title')}
        >
          <header className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void markAllRead()}
                className="h-auto px-2 py-1 text-xs"
              >
                {t('notifications.markAllRead')}
              </Button>
            ) : null}
          </header>
          <ul className="max-h-96 overflow-y-auto">
            {(data ?? []).length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                {t('notifications.empty')}
              </li>
            ) : (
              (data ?? []).map((row) => (
                <NotificationItem
                  key={row.id}
                  row={row}
                  onClick={() => void markRead(row.id)}
                  locale={i18n.language}
                />
              ))
            )}
          </ul>
        </DismissableDropdown>
      ) : null}
    </div>
  );
}

function DismissableDropdown({
  containerRef,
  onDismiss,
  ariaLabel,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  onDismiss: () => void;
  ariaLabel: string;
  children: ReactNode;
}): JSX.Element {
  // Listeners attach only while the dropdown is mounted.
  useMountEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        onDismiss();
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  });
  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      className="absolute right-0 z-30 mt-2 w-80 origin-top-right rounded-lg border bg-popover text-popover-foreground shadow-lg"
    >
      {children}
    </div>
  );
}

interface ItemProps {
  row: NotificationRow;
  onClick: () => void;
  locale: string;
}

function NotificationItem({ row, onClick, locale }: ItemProps): JSX.Element {
  const isUnread = row.read_at === null;
  return (
    <li className={cn('border-b last:border-b-0', isUnread ? 'bg-primary/5' : '')}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm hover:bg-muted/60"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium">{row.subject}</span>
          {isUnread ? (
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          ) : null}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{row.body}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatRelative(row.sent_at, locale)}
        </span>
      </button>
    </li>
  );
}
