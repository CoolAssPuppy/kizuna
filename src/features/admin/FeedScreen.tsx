import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { mediumDateTimeFormatter } from '@/lib/formatters';
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
} from './api/feed';

const LOCATIONS: ReadonlyArray<FeedLocation> = ['main', 'sidebar'];

interface DraftItem {
  id?: string;
  location: FeedLocation;
  title: string;
  subtitle: string;
  body: string;
  image_url: string;
  link_url: string;
  occurs_at: string;
  starts_displaying_at: string;
  ends_displaying_at: string;
}

const EMPTY_DRAFT = (location: FeedLocation): DraftItem => ({
  location,
  title: '',
  subtitle: '',
  body: '',
  image_url: '',
  link_url: '',
  occurs_at: '',
  starts_displaying_at: '',
  ends_displaying_at: '',
});

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
    image_url: row.image_url ?? '',
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
  const [editing, setEditing] = useState<DraftItem | null>(null);

  const { data: items } = useQuery({
    queryKey: ['admin', 'feed', eventId],
    enabled: eventId !== null,
    queryFn: () => (eventId ? fetchAllFeedItems(getSupabaseClient(), eventId) : Promise.resolve([])),
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
        image_url: draft.image_url || null,
        link_url: draft.link_url || null,
        occurs_at: toIso(draft.occurs_at),
        starts_displaying_at: toIso(draft.starts_displaying_at),
        ends_displaying_at: toIso(draft.ends_displaying_at),
      };
      if (draft.id) return updateFeedItem(getSupabaseClient(), draft.id, payload);
      // New row goes to the end of its bucket.
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

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.feed.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.feed.subtitle')}</p>
      </header>

      {LOCATIONS.map((location) => {
        const bucket = (items ?? []).filter((i) => i.location === location);
        return (
          <FeedBucket
            key={location}
            location={location}
            items={bucket}
            onCreate={() => setEditing(EMPTY_DRAFT(location))}
            onEdit={(row) => setEditing(rowToDraft(row))}
            onDelete={(row) => {
              if (confirm(t('admin.feed.deleteConfirm'))) remove.mutate(row.id);
            }}
            onReorder={(orderedIds) => reorder.mutate(orderedIds)}
          />
        );
      })}

      {editing ? (
        <FeedEditor
          draft={editing}
          onCancel={() => setEditing(null)}
          onSave={(d) => save.mutate(d)}
          saving={save.isPending}
        />
      ) : null}
    </section>
  );
}

interface FeedBucketProps {
  location: FeedLocation;
  items: FeedItemRow[];
  onCreate: () => void;
  onEdit: (row: FeedItemRow) => void;
  onDelete: (row: FeedItemRow) => void;
  onReorder: (orderedIds: string[]) => void;
}

function FeedBucket({
  location,
  items,
  onCreate,
  onEdit,
  onDelete,
  onReorder,
}: FeedBucketProps): JSX.Element {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(targetId: string): void {
    if (!dragId || dragId === targetId) return;
    const fromIdx = items.findIndex((i) => i.id === dragId);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = items.slice();
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    onReorder(next.map((i) => i.id));
    setDragId(null);
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t(`admin.feed.locations.${location}`)}
        </h3>
        <Button size="sm" variant="outline" onClick={onCreate} className="gap-2">
          <Plus aria-hidden className="h-3.5 w-3.5" />
          {t('admin.feed.newItem')}
        </Button>
      </header>
      {items.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          {t('admin.feed.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(item.id)}
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

interface FeedEditorProps {
  draft: DraftItem;
  onCancel: () => void;
  onSave: (draft: DraftItem) => void;
  saving: boolean;
}

function FeedEditor({ draft, onCancel, onSave, saving }: FeedEditorProps): JSX.Element {
  const { t } = useTranslation();
  const [state, setState] = useState<DraftItem>(draft);
  return (
    <form
      className="space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(state);
      }}
    >
      <h3 className="text-lg font-semibold">
        {state.id ? t('admin.feed.edit') : t('admin.feed.create')}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('admin.feed.fields.location')}</Label>
          <select
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
          <Label>{t('admin.feed.fields.title')}</Label>
          <Input
            required
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>{t('admin.feed.fields.subtitle')}</Label>
          <Input
            value={state.subtitle}
            onChange={(e) => setState({ ...state, subtitle: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>{t('admin.feed.fields.body')}</Label>
          <Textarea
            value={state.body}
            rows={3}
            onChange={(e) => setState({ ...state, body: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('admin.feed.fields.image')}</Label>
          <Input
            type="url"
            value={state.image_url}
            onChange={(e) => setState({ ...state, image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('admin.feed.fields.link')}</Label>
          <Input
            type="url"
            value={state.link_url}
            onChange={(e) => setState({ ...state, link_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('admin.feed.fields.occursAt')}</Label>
          <Input
            type="datetime-local"
            value={state.occurs_at}
            onChange={(e) => setState({ ...state, occurs_at: e.target.value })}
          />
        </div>
        <div />
        <div className="space-y-1.5">
          <Label>{t('admin.feed.fields.startsDisplayingAt')}</Label>
          <Input
            type="datetime-local"
            value={state.starts_displaying_at}
            onChange={(e) => setState({ ...state, starts_displaying_at: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('admin.feed.fields.endsDisplayingAt')}</Label>
          <Input
            type="datetime-local"
            value={state.ends_displaying_at}
            onChange={(e) => setState({ ...state, ends_displaying_at: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('admin.feed.saving') : t('admin.feed.save')}
        </Button>
      </div>
    </form>
  );
}
