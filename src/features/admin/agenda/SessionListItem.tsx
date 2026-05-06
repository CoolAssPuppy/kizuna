import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { isGuestOptInSession } from '@/features/agenda/sessionRules';
import { TagPills } from '@/features/agenda/TagPill';
import { type SessionTag } from '@/features/agenda/tagsApi';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { cn } from '@/lib/utils';

import { type SessionRow } from '../api/sessions';

interface SessionListItemProps {
  session: SessionRow;
  tags: ReadonlyArray<SessionTag>;
  isPast: boolean;
  expectedEmployees: number;
  expectedGuests: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function SessionListItem({
  session,
  tags,
  isPast,
  expectedEmployees,
  expectedGuests,
  onEdit,
  onDelete,
}: SessionListItemProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      className={cn(
        'group flex items-start gap-3 px-4 py-3 text-sm hover:bg-muted/30',
        isPast && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-start gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span className="font-medium">{session.title}</span>
          {session.subtitle ? (
            <p className="text-xs text-muted-foreground">{session.subtitle}</p>
          ) : null}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t(`admin.agenda.types.${session.type}`)} ·{' '}
            {t(`admin.agenda.audiences.${session.audience}`)}
            {session.location ? ` · ${session.location}` : ''}
          </p>
          {isGuestOptInSession(session) ? (
            <p className="text-[11px] text-muted-foreground">
              {t('admin.agenda.expectedAttendance', {
                employees: expectedEmployees,
                guests: expectedGuests,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {session.starts_at ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {mediumDateTimeFormatter.format(new Date(session.starts_at))}
            </span>
          ) : null}
          <TagPills tags={tags} className="justify-end" />
        </div>
      </button>
      <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label={t('actions.edit')}
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onDelete}
          aria-label={t('actions.delete')}
        >
          <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
