import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SpeakerTypeahead } from '@/features/agenda/SpeakerTypeahead';
import { TagPicker } from '@/features/agenda/TagPicker';
import { fetchEventTags } from '@/features/agenda/tagsApi';
import { getSupabaseClient } from '@/lib/supabase';

import type { SessionAudience, SessionStatus, SessionType } from './api/sessions';
import { type SessionDraft, emptySessionDraft } from './sessionDraft';

const SESSION_TYPES: ReadonlyArray<SessionType> = [
  'keynote',
  'breakout',
  'workshop',
  'dinner',
  'activity',
  'transport',
  'social',
];

const AUDIENCES: ReadonlyArray<SessionAudience> = [
  'all',
  'employees_only',
  'guests_only',
  'opt_in',
];

const STATUSES: ReadonlyArray<SessionStatus> = ['proposed', 'active'];

interface SessionDialogProps {
  draft: SessionDraft | null;
  /** IANA tz of the event. Both inputs are interpreted as wall-clock here. */
  timeZone: string;
  /** Event id powers the speaker typeahead. */
  eventId: string;
  /**
   * 'admin' renders every field including starts/ends/location/capacity
   * and a status select. 'propose' is the simplified self-service flow:
   * no schedule fields, status is fixed at 'proposed'.
   */
  mode?: 'admin' | 'propose';
  /** Optional inline warning shown above the form (e.g. "editing wipes votes"). */
  warning?: string | null;
  onClose: () => void;
  onSave: (draft: SessionDraft) => void;
  saving: boolean;
}

export function SessionDialog(props: SessionDialogProps): JSX.Element {
  // Remount when a different draft opens so initial state reflects it.
  const key = props.draft === null ? 'closed' : (props.draft.id ?? 'new');
  return <SessionDialogInner key={key} {...props} />;
}

function SessionDialogInner({
  draft,
  timeZone,
  eventId,
  mode = 'admin',
  warning,
  onClose,
  onSave,
  saving,
}: SessionDialogProps): JSX.Element {
  const { t } = useTranslation();
  const open = draft !== null;
  const [state, setState] = useState<SessionDraft>(draft ?? emptySessionDraft());
  const isPropose = mode === 'propose';
  const showScheduleFields = !isPropose;
  const { data: tags = [] } = useQuery({
    queryKey: ['agenda', 'tags', eventId],
    enabled: open && Boolean(eventId),
    queryFn: () => fetchEventTags(getSupabaseClient(), eventId),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(state);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isPropose
                ? state.id
                  ? t('agenda.proposals.editTitle')
                  : t('agenda.proposals.dialogTitle')
                : state.id
                  ? t('admin.agenda.editSession')
                  : t('admin.agenda.addSession')}
            </DialogTitle>
          </DialogHeader>

          {warning ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {warning}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-5 py-3 md:grid-cols-2 md:gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="session-title">{t('admin.agenda.fields.title')}</Label>
              <Input
                id="session-title"
                required
                value={state.title}
                onChange={(e) => setState({ ...state, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="session-subtitle">{t('admin.agenda.fields.subtitle')}</Label>
              <Input
                id="session-subtitle"
                value={state.subtitle}
                onChange={(e) => setState({ ...state, subtitle: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="session-type">{t('admin.agenda.fields.type')}</Label>
              <select
                id="session-type"
                value={state.type}
                onChange={(e) => {
                  const next = SESSION_TYPES.find((s) => s === e.target.value);
                  if (next) setState({ ...state, type: next });
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {SESSION_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {t(`admin.agenda.types.${s}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="session-audience">{t('admin.agenda.fields.audience')}</Label>
              <select
                id="session-audience"
                value={state.audience}
                onChange={(e) => {
                  const next = AUDIENCES.find((a) => a === e.target.value);
                  if (next) setState({ ...state, audience: next });
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {t(`admin.agenda.audiences.${a}`)}
                  </option>
                ))}
              </select>
            </div>

            {showScheduleFields ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="session-starts">{t('admin.agenda.fields.startsAt')}</Label>
                  <Input
                    id="session-starts"
                    type="datetime-local"
                    required
                    value={state.starts_at}
                    onChange={(e) => setState({ ...state, starts_at: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('admin.agenda.fields.timeZoneHint', { timeZone })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="session-ends">{t('admin.agenda.fields.endsAt')}</Label>
                  <Input
                    id="session-ends"
                    type="datetime-local"
                    required
                    value={state.ends_at}
                    onChange={(e) => setState({ ...state, ends_at: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('admin.agenda.fields.timeZoneHint', { timeZone })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="session-location">{t('admin.agenda.fields.location')}</Label>
                  <Input
                    id="session-location"
                    value={state.location}
                    onChange={(e) => setState({ ...state, location: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="session-capacity">{t('admin.agenda.fields.capacity')}</Label>
                  <Input
                    id="session-capacity"
                    type="number"
                    min={1}
                    value={state.capacity}
                    onChange={(e) => setState({ ...state, capacity: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="session-status">{t('admin.agenda.fields.status')}</Label>
                  <select
                    id="session-status"
                    value={state.status}
                    onChange={(e) => {
                      const next = STATUSES.find((s) => s === e.target.value);
                      if (next) setState({ ...state, status: next });
                    }}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`admin.agenda.statuses.${s}`)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.agenda.fields.statusHint')}
                  </p>
                </div>
              </>
            ) : null}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="session-speaker">{t('admin.agenda.fields.speaker')}</Label>
              <SpeakerTypeahead
                eventId={eventId}
                value={state.speaker_email}
                onChange={(email) => setState({ ...state, speaker_email: email })}
                inputId="session-speaker"
                placeholder={t('admin.agenda.fields.speakerPlaceholder')}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="session-abstract">{t('admin.agenda.fields.abstract')}</Label>
              <Textarea
                id="session-abstract"
                rows={4}
                value={state.abstract}
                onChange={(e) => setState({ ...state, abstract: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <TagPicker
                tags={tags}
                selectedIds={state.tag_ids}
                onChange={(next) => setState({ ...state, tag_ids: next })}
                inputId="session-tags"
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox
                id="session-mandatory"
                checked={state.is_mandatory}
                onCheckedChange={(checked) =>
                  setState({ ...state, is_mandatory: checked === true })
                }
              />
              <Label htmlFor="session-mandatory" className="text-sm font-normal">
                {t('admin.agenda.fields.mandatory')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? t('admin.agenda.saving')
                : isPropose
                  ? t('agenda.proposals.submit')
                  : t('admin.agenda.saveSession')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
