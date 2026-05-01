import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import {
  type NotificationChannel,
  type NotificationType,
  type NudgeAudience,
  type UserSearchResult,
  searchUsers,
  sendNudge,
} from './api/nudges';

const CHANNELS: ReadonlyArray<NotificationChannel> = ['in_app', 'email', 'slack'];
const TYPES: ReadonlyArray<NotificationType> = [
  'announcement',
  'nudge',
  'deadline_reminder',
  'flight_update',
  'room_assignment',
  'checkin_reminder',
];

type AudienceKind = NudgeAudience['kind'];

interface NudgeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NudgeDialog(props: NudgeDialogProps): JSX.Element {
  // Re-key on open so all local state resets to defaults each time.
  return <NudgeDialogInner key={props.open ? 'open' : 'closed'} {...props} />;
}

function NudgeDialogInner({ open, onClose }: NudgeDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<NotificationChannel>('in_app');
  const [type, setType] = useState<NotificationType>('announcement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('all_employees');
  const [pickedUser, setPickedUser] = useState<UserSearchResult | null>(null);
  const [search, setSearch] = useState('');

  // TanStack Query handles cancellation + dedup; per-keystroke is fine
  // for an admin tool against a narrow people search.
  const trimmedSearch = search.trim();
  const searchEnabled = audienceKind === 'user' && !pickedUser && trimmedSearch.length > 0;
  const { data: results = [] } = useQuery({
    queryKey: ['admin', 'nudges', 'userSearch', trimmedSearch],
    queryFn: () => searchUsers(getSupabaseClient(), trimmedSearch),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const audience = useMemo<NudgeAudience | null>(() => {
    if (audienceKind === 'user') return pickedUser ? { kind: 'user', userId: pickedUser.id } : null;
    return { kind: audienceKind };
  }, [audienceKind, pickedUser]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!audience) throw new Error('No audience selected');
      return sendNudge(getSupabaseClient(), {
        channel,
        type,
        subject,
        body,
        audience,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'nudges'] });
      show(t('admin.nudges.sent', { delivered: result.delivered, attempted: result.attempted }));
      onClose();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const submitDisabled =
    mutation.isPending ||
    !subject.trim() ||
    !body.trim() ||
    !audience ||
    (audienceKind === 'user' && !pickedUser);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('admin.nudges.send')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nudge-channel">{t('admin.nudges.fields.channel')}</Label>
                <select
                  id="nudge-channel"
                  value={channel}
                  onChange={(e) => {
                    const next = CHANNELS.find((c) => c === e.target.value);
                    if (next) setChannel(next);
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {t(`admin.nudges.channels.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nudge-type">{t('admin.nudges.fields.type')}</Label>
                <select
                  id="nudge-type"
                  value={type}
                  onChange={(e) => {
                    const next = TYPES.find((tp) => tp === e.target.value);
                    if (next) setType(next);
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {t(`admin.nudges.types.${tp}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.nudges.fields.audience')}</Label>
              <div className="flex flex-wrap gap-2">
                {(['all_employees', 'all_guests', 'user'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setAudienceKind(kind)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                      audienceKind === kind
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {t(`admin.nudges.audiences.${kind}`)}
                  </button>
                ))}
              </div>

              {audienceKind === 'user' ? (
                <div className="space-y-2 pt-1">
                  {pickedUser ? (
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span>{pickedUser.email}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPickedUser(null);
                          setSearch('');
                        }}
                      >
                        {t('admin.nudges.clearUser')}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder={t('admin.nudges.userPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {results.length > 0 ? (
                        <ul className="max-h-40 overflow-y-auto rounded-md border bg-background text-sm">
                          {results.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPickedUser(u);
                                  setSearch('');
                                }}
                                className="block w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                              >
                                {u.email}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nudge-subject">{t('admin.nudges.fields.subject')}</Label>
              <Input
                id="nudge-subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nudge-body">{t('admin.nudges.fields.body')}</Label>
              <Textarea
                id="nudge-body"
                rows={5}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {mutation.isPending ? t('admin.nudges.sending') : t('admin.nudges.sendCta')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
