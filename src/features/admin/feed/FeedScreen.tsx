import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StorageImageUploader } from '@/components/StorageImageUploader';
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
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { STORAGE_BUCKETS } from '@/lib/storageBuckets';
import { useDragReorder } from '@/hooks/useDragReorder';
import { eventFeedFolder } from '@/lib/storagePaths';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import {
  type FeedItemRow,
  type FeedLocation,
  createFeedItem,
  deleteFeedItem,
  fetchAllFeedItems,
  reorderFeedItems,
  updateFeedItem,
} from '../api/feed';

const LOCATIONS: ReadonlyArray<FeedLocation> = ['main', 'sidebar'];

interface DraftItem {
  id?: string;
  location: FeedLocation;
  title: string;
  subtitle: string;
  body: string;
  image_path: string;
  link_url: string;
  occurs_at: string;
  starts_displaying_at: string;
  ends_displaying_at: string;
}

const EMPTY_DRAFT: DraftItem = {
  location: 'main',
  title: '',
  subtitle: '',
  body: '',
  image_path: '',
  link_url: '',
  occurs_at: '',
  starts_displaying_at: '',
  ends_displaying_at: '',
};

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function fromIso(value: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

function rowToDraft(row: FeedItemRow): DraftItem {
  return {
    id: row.id,
    location: row.location,
    title: row.title,
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    image_path: row.image_path ?? '',
    link_url: row.link_url ?? '',
    occurs_at: fromIso(row.occurs_at),
    starts_displaying_at: fromIso(row.starts_displaying_at),
    ends_displaying_at: fromIso(row.ends_displaying_at),
  };
}

export function FeedScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const queryClient = useQueryClient();
  const { show } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<DraftItem | null>(null);

  const { data: items } = useQuery({
    queryKey: ['admin', 'feed', eventId],
    enabled: eventId !== null,
    queryFn: () =>
      eventId ? fetchAllFeedItems(getSupabaseClient(), eventId) : Promise.resolve([]),
  });

  const save = useMutation({
    mutationFn: async (draft: DraftItem) => {
      if (!eventId) throw new Error('No active event');
      const payload = {
        event_id: eventId,
        location: draft.location,
        title: draft.title,
        subtitle: draft.subtitle || null,
        body: draft.body || null,
        image_path: draft.image_path || null,
        link_url: draft.link_url || null,
        occurs_at: toIso(draft.occurs_at),
        starts_displaying_at: toIso(draft.starts_displaying_at),
        ends_displaying_at: toIso(draft.ends_displaying_at),
      };
      if (draft.id) return updateFeedItem(getSupabaseClient(), draft.id, payload);
      const same = (items ?? []).filter((i) => i.location === draft.location);
      return createFeedItem(getSupabaseClient(), { ...payload, position: same.length });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
      setEditing(null);
      show(t('admin.feed.saved'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteFeedItem(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
      show(t('admin.feed.deleted'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) =>
      reorderFeedItems(getSupabaseClient(), { orderedIds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'feed'] });
    },
  });

  if (!event) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }

  const all = items ?? [];

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.feed.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.feed.subtitle')}</p>
        </div>
        <Button onClick={() => setEditing(EMPTY_DRAFT)} className="gap-2 self-start">
          <Plus aria-hidden className="h-4 w-4" />
          {t('admin.feed.newItem')}
        </Button>
      </header>

      {all.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('admin.feed.noItems')}
        </p>
      ) : (
        LOCATIONS.map((location) => {
          const bucket = all.filter((i) => i.location === location);
          return (
            <FeedBucket
              key={location}
              location={location}
              items={bucket}
              onEdit={(row) => setEditing(rowToDraft(row))}
              onDelete={(row) => {
                void (async () => {
                  if (
                    await confirm({
                      titleKey: 'admin.feed.deleteConfirm',
                      destructive: true,
                    })
                  ) {
                    remove.mutate(row.id);
                  }
                })();
              }}
              onReorder={(orderedIds) => reorder.mutate(orderedIds)}
            />
          );
        })
      )}

      <FeedDialog
        draft={editing}
        eventId={eventId}
        onClose={() => setEditing(null)}
        onSave={(d) => save.mutate(d)}
        saving={save.isPending}
      />
    </section>
  );
}

interface FeedBucketProps {
  location: FeedLocation;
  items: FeedItemRow[];
  onEdit: (row: FeedItemRow) => void;
  onDelete: (row: FeedItemRow) => void;
  onReorder: (orderedIds: string[]) => void;
}

function FeedBucket({
  location,
  items,
  onEdit,
  onDelete,
  onReorder,
}: FeedBucketProps): JSX.Element {
  const { t } = useTranslation();
  const { dragId, rowProps } = useDragReorder(items, onReorder);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t(`admin.feed.locations.${location}`)}
      </h3>
      {items.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          {t('admin.feed.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              {...rowProps(item.id)}
              className={cn(
                'group flex items-start gap-3 rounded-lg border bg-card p-3 transition-shadow',
                dragId === item.id ? 'opacity-60' : 'hover:shadow-sm',
              )}
            >
              <GripVertical
                aria-hidden
                className="mt-1 h-4 w-4 shrink-0 cursor-grab text-muted-foreground"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                {item.subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
                <DisplayWindow item={item} />
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => onEdit(item)}>
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(item)}>
                  <Trash2 aria-hidden className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DisplayWindow({ item }: { item: FeedItemRow }): JSX.Element | null {
  const { t } = useTranslation();
  if (!item.starts_displaying_at && !item.ends_displaying_at) return null;
  const start = item.starts_displaying_at
    ? mediumDateTimeFormatter.format(new Date(item.starts_displaying_at))
    : t('admin.feed.alwaysOpen');
  const end = item.ends_displaying_at
    ? mediumDateTimeFormatter.format(new Date(item.ends_displaying_at))
    : t('admin.feed.alwaysOpen');
  return (
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
      {start} → {end}
    </p>
  );
}

interface FeedDialogProps {
  eventId: string | null;
  draft: DraftItem | null;
  onClose: () => void;
  onSave: (draft: DraftItem) => void;
  saving: boolean;
}

function FeedDialog(props: FeedDialogProps): JSX.Element {
  // Re-mount when a different draft opens so initial state reflects it.
  const key = props.draft === null ? 'closed' : (props.draft.id ?? 'new');
  return <FeedDialogInner key={key} {...props} />;
}

function FeedDialogInner({
  draft,
  eventId,
  onClose,
  onSave,
  saving,
}: FeedDialogProps): JSX.Element {
  const { t } = useTranslation();
  const open = draft !== null;
  // Hold a local working copy so typing into fields isn't blocked on parent renders.
  const [state, setState] = useState<DraftItem>(draft ?? EMPTY_DRAFT);

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
            <DialogTitle>{state.id ? t('admin.feed.edit') : t('admin.feed.create')}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="feed-location">{t('admin.feed.fields.location')}</Label>
              <select
                id="feed-location"
                value={state.location}
                onChange={(e) => setState({ ...state, location: e.target.value as FeedLocation })}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {t(`admin.feed.locations.${loc}`)}
                  </option>
                ))}
              </select>
            </div>
            <div />
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="feed-title">{t('admin.feed.fields.title')}</Label>
              <Input
                id="feed-title"
                required
                value={state.title}
                onChange={(e) => setState({ ...state, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="feed-subtitle">{t('admin.feed.fields.subtitle')}</Label>
              <Input
                id="feed-subtitle"
                value={state.subtitle}
                onChange={(e) => setState({ ...state, subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="feed-body">{t('admin.feed.fields.body')}</Label>
              <Textarea
                id="feed-body"
                value={state.body}
                rows={3}
                onChange={(e) => setState({ ...state, body: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <StorageImageUploader
                bucket={STORAGE_BUCKETS.eventContent}
                folder={eventId ? eventFeedFolder(eventId) : ''}
                value={state.image_path}
                onChange={(p) => setState({ ...state, image_path: p })}
                label={t('admin.feed.fields.image')}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="feed-link">{t('admin.feed.fields.link')}</Label>
              <Input
                id="feed-link"
                type="url"
                value={state.link_url}
                onChange={(e) => setState({ ...state, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-occurs">{t('admin.feed.fields.occursAt')}</Label>
              <Input
                id="feed-occurs"
                type="datetime-local"
                value={state.occurs_at}
                onChange={(e) => setState({ ...state, occurs_at: e.target.value })}
              />
            </div>
            <div />
            <div className="space-y-1.5">
              <Label htmlFor="feed-start">{t('admin.feed.fields.startsDisplayingAt')}</Label>
              <Input
                id="feed-start"
                type="datetime-local"
                value={state.starts_displaying_at}
                onChange={(e) => setState({ ...state, starts_displaying_at: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-end">{t('admin.feed.fields.endsDisplayingAt')}</Label>
              <Input
                id="feed-end"
                type="datetime-local"
                value={state.ends_displaying_at}
                onChange={(e) => setState({ ...state, ends_displaying_at: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('admin.feed.saving') : t('admin.feed.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
