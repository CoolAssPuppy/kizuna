import { ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
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
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { cn } from '@/lib/utils';

import { type AttendeeSearchResult } from './api';
import { HighlightedCaption } from './HighlightedCaption';
import { useAttendeeSearch, useUploadPhoto } from './hooks';
import { processImage } from './imageProcess';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
}

interface DraftItem {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  tagged: AttendeeSearchResult[];
}

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|heic|heif)$/;

export function PhotoUploadDialog({ open, onClose, eventId }: Props): JSX.Element {
  return (
    <PhotoUploadDialogInner
      key={open ? 'open' : 'closed'}
      open={open}
      onClose={onClose}
      eventId={eventId}
    />
  );
}

function PhotoUploadDialogInner({ open, onClose, eventId }: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<DraftItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto();

  const active = useMemo(() => items.find((i) => i.id === activeId) ?? null, [items, activeId]);
  const attendeeQuery = useAttendeeSearch(active ? tagQuery : '');

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    // Object URLs created in handlePick must be revoked when the dialog
    // unmounts or the corresponding draft is removed.
    return () => {
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePick(picked: FileList | null): void {
    if (!picked || picked.length === 0) return;
    const drafts: DraftItem[] = [];
    let rejectedType = false;
    let rejectedSize = false;
    for (const file of Array.from(picked)) {
      if (drafts.length + items.length >= MAX_FILES) break;
      if (!ALLOWED.test(file.type)) {
        rejectedType = true;
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejectedSize = true;
        continue;
      }
      drafts.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: '',
        tagged: [],
      });
    }
    if (rejectedType) show(t('photos.upload.errors.type'), 'error');
    if (rejectedSize) show(t('photos.upload.errors.size', { max: '25 MB' }), 'error');
    if (drafts.length === 0) return;
    setItems((prev) => [...prev, ...drafts]);
    setActiveId((prev) => prev ?? drafts[0]?.id ?? null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    handlePick(e.dataTransfer.files);
  }

  function removeItem(id: string): void {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((i) => i.id !== id);
      return next;
    });
    setActiveId((prev) => (prev === id ? (items.find((i) => i.id !== id)?.id ?? null) : prev));
  }

  function updateItem(id: string, patch: Partial<DraftItem>): void {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function addTag(itemId: string, person: AttendeeSearchResult): void {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.tagged.some((p) => p.user_id === person.user_id)) return;
    updateItem(itemId, { tagged: [...item.tagged, person] });
    setTagQuery('');
  }

  function removeTag(itemId: string, userId: string): void {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    updateItem(itemId, { tagged: item.tagged.filter((p) => p.user_id !== userId) });
  }

  async function handleSubmit(): Promise<void> {
    if (items.length === 0 || !user) return;
    let succeeded = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const processed = await processImage(item.file);
        await upload.mutateAsync({
          eventId,
          uploaderId: user.id,
          original: processed.original,
          preview: processed.preview,
          thumb: processed.thumb,
          width: processed.width,
          height: processed.height,
          caption: item.caption,
          taggedUserIds: item.tagged.map((t) => t.user_id),
        });
        succeeded += 1;
      } catch (err) {
        console.error('[kizuna] photo upload failed', err);
        failed += 1;
      }
    }
    if (succeeded > 0) {
      show(t('photos.upload.successCount', { count: succeeded }));
    }
    if (failed > 0) {
      show(t('photos.upload.errors.someFailed', { count: failed }), 'error');
      return;
    }
    onClose();
  }

  const filteredResults = active
    ? (attendeeQuery.data ?? []).filter((r) => !active.tagged.some((p) => p.user_id === r.user_id))
    : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('photos.upload.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            onChange={(e) => handlePick(e.target.files)}
          />

          {items.length === 0 ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed text-sm"
              style={{ borderColor: 'var(--c-rule)', color: 'var(--c-muted)' }}
            >
              <ImagePlus aria-hidden className="h-6 w-6" />
              <span>{t('photos.upload.drop')}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('photos.upload.pick')}
              </Button>
            </label>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                  {t('photos.upload.count', { current: items.length, max: MAX_FILES })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={items.length >= MAX_FILES}
                >
                  {t('photos.upload.addMore')}
                </Button>
              </div>
              <ul
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
                style={{ scrollbarWidth: 'thin' }}
              >
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        'relative block h-20 w-20 overflow-hidden border',
                        item.id === activeId ? 'ring-2 ring-offset-2' : '',
                      )}
                      style={{
                        borderColor: item.id === activeId ? 'var(--c-accent)' : 'var(--c-rule)',
                        backgroundColor: 'var(--c-surface)',
                      }}
                      aria-label={t('photos.upload.editFile', { name: item.file.name })}
                    >
                      <img
                        src={item.previewUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>

              {active ? (
                <ItemEditor
                  key={active.id}
                  item={active}
                  filteredResults={filteredResults}
                  tagQuery={tagQuery}
                  onTagQueryChange={setTagQuery}
                  onCaptionChange={(caption) => updateItem(active.id, { caption })}
                  onAddTag={(p) => addTag(active.id, p)}
                  onRemoveTag={(uid) => removeTag(active.id, uid)}
                  onRemove={() => removeItem(active.id)}
                />
              ) : null}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={upload.isPending}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={items.length === 0 || upload.isPending}
            onClick={() => void handleSubmit()}
          >
            {upload.isPending ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {items.length > 1
              ? t('photos.upload.submitMany', { count: items.length })
              : t('photos.upload.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemEditorProps {
  item: DraftItem;
  filteredResults: ReadonlyArray<AttendeeSearchResult>;
  tagQuery: string;
  onTagQueryChange: (next: string) => void;
  onCaptionChange: (next: string) => void;
  onAddTag: (person: AttendeeSearchResult) => void;
  onRemoveTag: (userId: string) => void;
  onRemove: () => void;
}

function ItemEditor({
  item,
  filteredResults,
  tagQuery,
  onTagQueryChange,
  onCaptionChange,
  onAddTag,
  onRemoveTag,
  onRemove,
}: ItemEditorProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="grid grid-cols-1 gap-4 border p-4 sm:grid-cols-[200px_1fr]"
      style={{ borderColor: 'var(--c-rule)' }}
    >
      <div className="relative">
        <img
          src={item.previewUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-48 w-full bg-c-surface object-contain sm:h-44"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('photos.upload.replace')}
          className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`caption-${item.id}`}>{t('photos.upload.caption')}</Label>
          <HighlightedCaption
            value={item.caption}
            onChange={onCaptionChange}
            placeholder={t('photos.upload.captionPlaceholder')}
            rows={3}
            ariaLabel={t('photos.upload.caption')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('photos.upload.taggedPeople')}</Label>
          {item.tagged.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {item.tagged.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center gap-2 border bg-muted/30 py-1 pl-2 pr-1 text-xs"
                  style={{ borderColor: 'var(--c-rule)' }}
                >
                  <Avatar
                    url={p.avatar_url}
                    fallback={
                      `${p.first_name?.charAt(0) ?? ''}${p.last_name?.charAt(0) ?? ''}` || '?'
                    }
                    size={20}
                  />
                  <span>{[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTag(p.user_id)}
                    aria-label={t('photos.upload.removeTag', { value: p.email })}
                    className="rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            placeholder={t('photos.upload.tagPlaceholder')}
            value={tagQuery}
            onChange={(e) => onTagQueryChange(e.target.value)}
          />
          {filteredResults.length > 0 ? (
            <ul
              className="max-h-40 overflow-y-auto rounded-md border text-sm"
              style={{ borderColor: 'var(--c-rule)' }}
            >
              {filteredResults.map((r) => (
                <li key={r.user_id}>
                  <button
                    type="button"
                    onClick={() => onAddTag(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                  >
                    <Avatar
                      url={r.avatar_url}
                      fallback={
                        `${r.first_name?.charAt(0) ?? ''}${r.last_name?.charAt(0) ?? ''}` || '?'
                      }
                      size={20}
                    />
                    <span className="font-medium">
                      {[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email}
                    </span>
                    <span className="ml-auto text-xs" style={{ color: 'var(--c-muted)' }}>
                      {r.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
