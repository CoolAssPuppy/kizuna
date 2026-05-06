import { Star, StarOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

import { type AgendaSession } from './api';
import { attendanceKey } from './guestAttendance';
import { TagPills } from './TagPill';

type AdditionalGuestRow = Database['public']['Tables']['additional_guests']['Row'];

interface SessionCardProps {
  session: AgendaSession;
  timeZone: string;
  isPast: boolean;
  onToggleFavorite: () => void;
  favoriteLabel: string;
  /** Omitted when this session does not expose the guest picker. */
  guestPicker?:
    | {
        guests: ReadonlyArray<AdditionalGuestRow>;
        attendance: ReadonlySet<string>;
        onToggle: (additionalGuestId: string, attending: boolean) => void;
      }
    | undefined;
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/**
 * Single agenda card. Renders the session header (time, title, subtitle,
 * speaker, abstract) plus a favorite toggle and an optional guest opt-in
 * picker. Mandatory sessions are auto-starred and the toggle is disabled
 * — the underlying state is implicit, surfacing it as "always on" matches
 * the data model.
 */
export function SessionCard({
  session,
  timeZone,
  isPast,
  onToggleFavorite,
  favoriteLabel,
  guestPicker,
}: SessionCardProps): JSX.Element {
  const { t } = useTranslation();
  const showAsStarred = session.is_favorite || session.is_mandatory;
  const Icon = showAsStarred ? Star : StarOff;
  const buttonLabel = session.is_mandatory ? t('agenda.mandatoryLabel') : favoriteLabel;
  return (
    <li
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40',
        isPast && 'opacity-50',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {session.starts_at && session.ends_at ? (
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              {formatTime(session.starts_at, timeZone)} — {formatTime(session.ends_at, timeZone)}
              {session.location ? <span> · {session.location}</span> : null}
            </p>
          ) : null}
          <h3 className="text-base font-semibold">{session.title}</h3>
          {session.subtitle ? (
            <p className="text-sm text-muted-foreground">{session.subtitle}</p>
          ) : null}
          {session.speaker_display_name || session.speaker_email ? (
            <p className="text-xs text-muted-foreground">
              {session.speaker_display_name ?? session.speaker_email}
            </p>
          ) : null}
          {session.abstract ? (
            <p className="pt-2 text-sm leading-relaxed text-foreground/80">{session.abstract}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <TagPills tags={session.tags} />
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={buttonLabel}
            title={buttonLabel}
            disabled={session.is_mandatory}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              showAsStarred
                ? 'text-amber-500 hover:bg-amber-100/40'
                : 'text-muted-foreground hover:bg-muted',
              session.is_mandatory && 'cursor-not-allowed opacity-80 hover:bg-transparent',
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      {guestPicker ? (
        <fieldset className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('agenda.guests.prompt')}
          </legend>
          <div className="flex flex-wrap gap-3 pt-1">
            {guestPicker.guests.map((guest) => {
              const id = `guest-attend-${session.id}-${guest.id}`;
              const checked = guestPicker.attendance.has(attendanceKey(session.id, guest.id));
              const guestName = `${guest.first_name} ${guest.last_name}`.trim();
              return (
                <label key={guest.id} htmlFor={id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => guestPicker.onToggle(guest.id, next === true)}
                  />
                  {guestName}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </li>
  );
}
