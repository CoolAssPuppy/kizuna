import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { EmailField } from '@/components/EmailField';
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
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { MemoriesSection } from './photos/MemoriesSection';
import { WorldMap } from './WorldMap';
import {
  createChannel,
  listChannelsWithLastMessage,
  loadCommunityPeople,
  loadCommunityProfile,
} from './api';
import {
  filterByCurrentTown,
  filterByHometown,
  rankByHobbyOverlap,
  type Profile,
} from './matching';
import { messageTimeLabel } from './timeLabel';

type MapMode = 'hometown' | 'current';

export function CommunityScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const qc = useQueryClient();
  const { show } = useToast();
  const [mapMode, setMapMode] = useState<MapMode>('hometown');
  const [newChannelOpen, setNewChannelOpen] = useState(false);

  const peopleQ = useQuery({
    queryKey: ['community', 'people'],
    queryFn: () => loadCommunityPeople(getSupabaseClient()),
  });
  const meQ = useQuery({
    queryKey: ['community', 'me', user?.id],
    queryFn: () => loadCommunityProfile(getSupabaseClient(), user!.id),
    enabled: !!user,
  });
  const channelsQ = useQuery({
    queryKey: ['community', 'channels'],
    queryFn: () => listChannelsWithLastMessage(getSupabaseClient()),
  });

  const me: Profile | null = useMemo(() => {
    if (!user || !meQ.data) return null;
    return {
      user_id: user.id,
      first_name: '',
      last_name: '',
      email: user.email,
      avatar_url: null,
      hobbies: meQ.data.hobbies,
      hometown_city: meQ.data.hometown_city,
      hometown_country: meQ.data.hometown_country,
      current_city: meQ.data.current_city,
      current_country: meQ.data.current_country,
    };
  }, [meQ.data, user]);

  const ranked = useMemo(() => {
    if (!me || !peopleQ.data) return [];
    return rankByHobbyOverlap(me, peopleQ.data);
  }, [me, peopleQ.data]);

  const homies = useMemo(() => {
    if (!me || !peopleQ.data) return [];
    return filterByHometown(me, peopleQ.data);
  }, [me, peopleQ.data]);

  const locals = useMemo(() => {
    if (!me || !peopleQ.data) return [];
    return filterByCurrentTown(me, peopleQ.data);
  }, [me, peopleQ.data]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('community.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('community.subtitle')}</p>
        </div>
        <Button asChild className="gap-2 self-start">
          <Link to="/profile/community">{t('community.editProfile')}</Link>
        </Button>
      </header>

      <WorldMap people={peopleQ.data ?? []} mode={mapMode} onToggle={setMapMode} />

      <PeopleSection
        title={t('community.matches.byHobby')}
        people={ranked}
        showMatched
        {...(ranked.length === 0 ? { emptyKey: 'community.matches.empty' } : {})}
      />

      <PeopleSection title={t('community.matches.byHometown')} people={homies} />

      <PeopleSection title={t('community.matches.byCurrent')} people={locals} />

      {event ? <MemoriesSection eventId={event.id} eventName={event.name} /> : null}

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t('community.channels.title')}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewChannelOpen(true)}
            className="gap-2"
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t('community.channels.newChannel')}
          </Button>
        </header>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(channelsQ.data ?? []).map((c) => (
            <li
              key={c.id}
              className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <Link
                to={`/community/channels/${c.slug}`}
                className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t('community.channels.openChannel', { name: c.name })}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Hash aria-hidden className="h-4 w-4 text-muted-foreground" />
                  {c.name}
                </div>
                {c.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                ) : null}
                <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                  {c.last_message_body
                    ? `${c.last_message_body} · ${
                        c.last_message_sent_at ? messageTimeLabel(c.last_message_sent_at) : ''
                      }`
                    : t('community.channels.noMessagesYet')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <NewChannelDialog
        open={newChannelOpen}
        onOpenChange={setNewChannelOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ['community', 'channels'] });
          show(t('community.channels.newChannel'));
        }}
      />
    </main>
  );
}

interface PeopleSectionProps {
  title: string;
  people: Array<Profile & { matched?: string[] }>;
  showMatched?: boolean;
  emptyKey?: string;
}

function PeopleSection({
  title,
  people,
  showMatched,
  emptyKey,
}: PeopleSectionProps): JSX.Element | null {
  const { t } = useTranslation();
  if (people.length === 0 && !emptyKey) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyKey ? t(emptyKey) : null}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">&nbsp;</th>
                <th className="px-3 py-2 font-medium">{t('community.matches.firstName')}</th>
                <th className="px-3 py-2 font-medium">{t('community.matches.lastName')}</th>
                <th className="px-3 py-2 font-medium">{t('community.matches.email')}</th>
                {showMatched ? (
                  <th className="px-3 py-2 font-medium">{t('community.matches.matchedHobbies')}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.user_id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      to={`/community/p/${p.user_id}`}
                      aria-label={`${p.first_name} ${p.last_name}`}
                    >
                      <Avatar
                        url={p.avatar_url}
                        fallback={`${p.first_name.charAt(0)}${p.last_name.charAt(0)}`}
                        size={32}
                      />
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/community/p/${p.user_id}`} className="hover:underline">
                      {p.first_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/community/p/${p.user_id}`} className="hover:underline">
                      {p.last_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <EmailField email={p.email} textClassName="text-c-muted" />
                  </td>
                  {showMatched ? (
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {(p.matched ?? []).join(', ')}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface NewChannelDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: () => void;
}

function NewChannelDialog({ open, onOpenChange, onCreated }: NewChannelDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { show } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setName('');
    setDescription('');
  }

  async function handleCreate(): Promise<void> {
    if (!user || busy) return;
    setBusy(true);
    try {
      await createChannel(getSupabaseClient(), user.id, {
        name,
        description: description.trim() || null,
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      show(err instanceof Error ? err.message : t('profile.toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('community.channels.newChannelTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-channel-name">{t('community.channels.newChannelName')}</Label>
            <Input
              id="new-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-channel-description">
              {t('community.channels.newChannelDescription')}
            </Label>
            <Textarea
              id="new-channel-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() => void handleCreate()}
          >
            {t('community.channels.newChannelCreate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
