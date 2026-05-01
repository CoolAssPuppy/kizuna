import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImagePlus, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';
import { getSupabaseClient } from '@/lib/supabase';

import { MarkdownText } from './MarkdownText';
import {
  broadcastToAllChannels,
  fetchChannelBySlug,
  fetchMessages,
  sendMessage,
  softDeleteMessage,
  type MessageWithSender,
} from './api';
import { groupMessagesForBubbles } from './bubbles';
import { messageTimeLabel } from './timeLabel';
import { useTypingPresence } from './useTypingPresence';

const COMMUNITY_MEDIA_BUCKET = 'community-media';

function senderLabel(m: MessageWithSender): string {
  if (!m.sender) return '';
  return (
    m.sender.employee_profiles?.preferred_name ??
    m.sender.guest_profiles?.full_name ??
    m.sender.email.split('@')[0] ??
    m.sender.email
  );
}

export function ChannelScreen(): JSX.Element {
  const { t } = useTranslation();
  const { slug = '' } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [broadcastChecked, setBroadcastChecked] = useState(false);
  const [confirmBroadcastOpen, setConfirmBroadcastOpen] = useState(false);

  const channelQ = useQuery({
    queryKey: ['community', 'channel', slug],
    queryFn: () => fetchChannelBySlug(getSupabaseClient(), slug),
    enabled: !!slug,
  });
  const messagesQ = useQuery({
    queryKey: ['community', 'messages', slug],
    queryFn: () => fetchMessages(getSupabaseClient(), slug),
    enabled: !!slug,
  });

  const myDisplayName = user?.email.split('@')[0] ?? '';
  const { typingUsers, emitTyping } = useTypingPresence(slug, myDisplayName);

  const groups = useMemo(() => groupMessagesForBubbles(messagesQ.data ?? []), [messagesQ.data]);

  // useEffect (not useMountEffect): channel filter is slug-scoped and
  // slug changes when the user navigates between community channels.
  // Realtime: refetch on insert / soft-delete in this channel.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!slug) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`community-messages:${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `channel=eq.${slug}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['community', 'messages', slug] });
          void qc.invalidateQueries({ queryKey: ['community', 'channels'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slug, qc]);

  // useEffect (not useMountEffect): re-runs when groups changes so
  // the message list scrolls to the latest bubble after every fetch.
  // The fix-without-effect pattern is a layout effect with mutation
  // observer, which is more code than this one-liner deserves.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [groups]);

  const sendMutation = useMutation({
    mutationFn: async (input: { body: string; mediaUrl: string | null }) => {
      if (!user || !slug) throw new Error('not ready');
      if (broadcastChecked && isAdmin) {
        const count = await broadcastToAllChannels(getSupabaseClient(), input.body);
        return { broadcast: count };
      }
      const result = await sendMessage(getSupabaseClient(), user.id, {
        channelSlug: slug,
        body: input.body,
        mediaUrl: input.mediaUrl,
      });
      return { broadcast: 0, id: result.id };
    },
    onSuccess: (out) => {
      setDraft('');
      setBroadcastChecked(false);
      if (out.broadcast > 0) {
        show(t('community.channels.broadcastSuccess', { count: out.broadcast }));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteMessage(getSupabaseClient(), id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', 'messages', slug] }),
  });

  async function handleFile(file: File): Promise<void> {
    if (!user) return;
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await getSupabaseClient()
      .storage.from(COMMUNITY_MEDIA_BUCKET)
      .upload(path, file, { upsert: false });
    if (error) {
      show(error.message, 'error');
      return;
    }
    sendMutation.mutate({ body: draft || file.name, mediaUrl: path });
  }

  function handleSend(): void {
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    if (broadcastChecked && isAdmin) {
      setConfirmBroadcastOpen(true);
      return;
    }
    sendMutation.mutate({ body, mediaUrl: null });
  }

  function confirmBroadcast(): void {
    setConfirmBroadcastOpen(false);
    sendMutation.mutate({ body: draft.trim(), mediaUrl: null });
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-8 py-6">
      <header className="flex items-center gap-3 border-b pb-3">
        <Button asChild variant="ghost" size="icon" aria-label={t('common.back')}>
          <Link to="/community">
            <ArrowLeft aria-hidden className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">#{channelQ.data?.name ?? slug}</h1>
          {channelQ.data?.description ? (
            <p className="text-xs text-muted-foreground">{channelQ.data.description}</p>
          ) : null}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-4">
        {groups.map((group) => {
          const sample = group.messages[0]!;
          const senderRow = (messagesQ.data ?? []).find((m) => m.id === sample.id);
          const isMe = group.sender_id === user?.id;
          const display = senderRow ? senderLabel(senderRow) : '';
          return (
            <article
              key={group.id}
              className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
            >
              <Avatar
                url={senderRow?.sender?.employee_profiles?.avatar_url ?? null}
                fallback={display}
                size={32}
              />
              <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe ? <p className="px-3 text-xs text-muted-foreground">{display}</p> : null}
                {group.messages.map((m) => {
                  const original = (messagesQ.data ?? []).find((x) => x.id === m.id);
                  return (
                    <div
                      key={m.id}
                      className={`group relative flex items-center gap-2 ${
                        isMe ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                          isMe
                            ? 'rounded-br-md bg-primary text-primary-foreground'
                            : 'rounded-bl-md bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {m.media_url ? <ChannelImage path={m.media_url} /> : null}
                        <MarkdownText source={m.body} />
                        {original?.edited_at ? (
                          <span className="ml-2 text-xs opacity-70">
                            {t('community.channels.edited')}
                          </span>
                        ) : null}
                      </div>
                      {isMe ? (
                        <button
                          type="button"
                          aria-label={t('community.channels.deleteMessage')}
                          className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                          onClick={() => deleteMutation.mutate(m.id)}
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                <p className={`px-3 text-[10px] text-muted-foreground ${isMe ? 'text-right' : ''}`}>
                  {messageTimeLabel(group.startedAt)}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <p className="h-5 text-xs text-muted-foreground">
        {typingUsers.length === 1
          ? t('community.channels.typing', {
              count: 1,
              name: typingUsers[0]!.displayName,
            })
          : typingUsers.length > 1
            ? t('community.channels.typing', { count: typingUsers.length })
            : ''}
      </p>

      <div className="flex flex-col gap-2 border-t pt-3">
        {isAdmin ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={broadcastChecked}
              onCheckedChange={(v) => setBroadcastChecked(v === true)}
            />
            {t('community.channels.broadcast')}
          </label>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendMutation.isPending || broadcastChecked}
            title={t('community.channels.imagePicker')}
            aria-label={t('community.channels.imagePicker')}
          >
            <ImagePlus aria-hidden className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
          <Input
            value={draft}
            placeholder={t('community.channels.messageInputPlaceholder')}
            onChange={(e) => {
              setDraft(e.target.value);
              emitTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="button"
            disabled={!draft.trim() || sendMutation.isPending}
            onClick={handleSend}
            aria-label={t('community.channels.send')}
            size="icon"
          >
            <Send aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={confirmBroadcastOpen} onOpenChange={setConfirmBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('community.channels.broadcastConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('community.channels.broadcastConfirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBroadcastOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={confirmBroadcast}>{t('community.channels.broadcastConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ChannelImage({ path }: { path: string }): JSX.Element | null {
  const { data: src = null } = useQuery({
    queryKey: ['community', 'media-signed-url', path],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await getSupabaseClient()
        .storage.from(COMMUNITY_MEDIA_BUCKET)
        .createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });
  if (!src) return null;
  return <img src={src} alt="" className="mb-2 max-h-72 w-full rounded-lg object-cover" />;
}
