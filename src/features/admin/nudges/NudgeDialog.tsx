import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
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
} from '../api/nudges';

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

const AUDIENCE_KINDS = [
  'everyone',
  'all_employees',
  'all_guests',
  'users',
] as const satisfies ReadonlyArray<AudienceKind>;

interface NudgeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NudgeDialog(props: NudgeDialogProps): JSX.Element {
  return <NudgeDialogInner key={props.open ? 'open' : 'closed'} {...props} />;
}

function NudgeDialogInner({ open, onClose }: NudgeDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [selectedChannels, setSelectedChannels] = useState<ReadonlyArray<NotificationChannel>>([
    'in_app',
  ]);
  const [type, setType] = useState<NotificationType>('announcement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('everyone');
  const [pickedUsers, setPickedUsers] = useState<ReadonlyArray<UserSearchResult>>([]);
  const [search, setSearch] = useState('');

  const trimmedSearch = search.trim();
  const searchEnabled = audienceKind === 'users' && trimmedSearch.length > 0;
  const { data: results = [] } = useQuery({
    queryKey: ['admin', 'nudges', 'userSearch', trimmedSearch],
    queryFn: () => searchUsers(getSupabaseClient(), trimmedSearch),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const audience = useMemo<NudgeAudience | null>(() => {
    if (audienceKind === 'users') {
      return pickedUsers.length > 0
        ? { kind: 'users', userIds: pickedUsers.map((u) => u.id) }
        : null;
    }
    return { kind: audienceKind };
  }, [audienceKind, pickedUsers]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!audience) throw new Error(t('admin.nudges.errors.noAudience'));
      if (selectedChannels.length === 0) throw new Error(t('admin.nudges.errors.noChannel'));
      return sendNudge(getSupabaseClient(), {
        channels: [...selectedChannels],
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
    selectedChannels.length === 0;

  function toggleChannel(channel: NotificationChannel): void {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  function addUser(user: UserSearchResult): void {
    if (pickedUsers.some((p) => p.id === user.id)) return;
    setPickedUsers((prev) => [...prev, user]);
    setSearch('');
  }

  function removeUser(userId: string): void {
    setPickedUsers((prev) => prev.filter((p) => p.id !== userId));
  }

  const filteredResults = results.filter((r) => !pickedUsers.some((p) => p.id === r.id));

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
            <div className="space-y-2">
              <Label>{t('admin.nudges.fields.channels')}</Label>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const active = selectedChannels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChannel(c)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {t(`admin.nudges.channels.${c}`)}
                    </button>
                  );
                })}
              </div>
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

            <div className="space-y-2">
              <Label>{t('admin.nudges.fields.audience')}</Label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCE_KINDS.map((kind) => (
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

              {audienceKind === 'users' ? (
                <div className="space-y-2 pt-1">
                  {pickedUsers.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {pickedUsers.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center gap-1 rounded-full border bg-muted/30 py-1 pl-3 pr-1 text-sm"
                        >
                          <span>{u.name || u.email}</span>
                          <button
                            type="button"
                            onClick={() => removeUser(u.id)}
                            aria-label={t('admin.nudges.removeUser', { value: u.email })}
                            className="rounded-full p-0.5 hover:bg-accent hover:text-accent-foreground"
                          >
                            <X aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Input
                    placeholder={t('admin.nudges.userPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {filteredResults.length > 0 ? (
                    <ul className="max-h-48 overflow-y-auto rounded-md border bg-background text-sm">
                      {filteredResults.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => addUser(u)}
                            className="block w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                          >
                            <span className="font-medium">{u.name || u.email}</span>
                            {u.name ? (
                              <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
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
