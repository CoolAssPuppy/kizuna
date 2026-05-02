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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';

import { type AttendeeSearchResult } from './api';
import { captionTokens } from './captionParser';
import { useAttendeeSearch, useUploadPhoto } from './hooks';
import { processImage } from './imageProcess';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
}

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|heic|heif)$/;

export function PhotoUploadDialog({ open, onClose, eventId }: Props): JSX.Element {
  return <PhotoUploadDialogInner key={open ? 'open' : 'closed'} open={open} onClose={onClose} eventId={eventId} />;
}

function PhotoUploadDialogInner({ open, onClose, eventId }: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [tagged, setTagged] = useState<AttendeeSearchResult[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto();
  const attendeeQuery = useAttendeeSearch(tagQuery);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    // Object URL must be created and revoked in lockstep with the
    // selected File. Can't be derived; not a mount-only effect.
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const tokens = useMemo(() => captionTokens(caption), [caption]);

  function handlePick(picked: File | null): void {
    if (!picked) return;
    if (!ALLOWED.test(picked.type)) {
      show(t('photos.upload.errors.type'), 'error');
      return;
    }
    if (picked.size > MAX_BYTES) {
      show(t('photos.upload.errors.size', { max: '25 MB' }), 'error');
      return;
    }
    setFile(picked);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0] ?? null;
    handlePick(dropped);
  }

  async function handleSubmit(): Promise<void> {
    if (!file || !user) return;
    try {
      const processed = await processImage(file);
      await upload.mutateAsync({
        eventId,
        uploaderId: user.id,
        original: processed.original,
        preview: processed.preview,
        thumb: processed.thumb,
        width: processed.width,
        height: processed.height,
        caption,
        taggedUserIds: tagged.map((t) => t.user_id),
      });
      show(t('photos.upload.success'));
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('photos.upload.errors.generic');
      show(message, 'error');
    }
  }

  function addTag(person: AttendeeSearchResult): void {
    if (tagged.some((p) => p.user_id === person.user_id)) return;
    setTagged((prev) => [...prev, person]);
    setTagQuery('');
  }

  function removeTag(userId: string): void {
    setTagged((prev) => prev.filter((p) => p.user_id !== userId));
  }

  const filteredResults = (attendeeQuery.data ?? []).filter(
    (r) => !tagged.some((p) => p.user_id === r.user_id),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('photos.upload.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt=""
                className="h-72 w-full rounded-md object-contain"
                style={{ backgroundColor: 'var(--c-surface)' }}
              />
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label={t('photos.upload.replace')}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed text-sm"
              style={{ borderColor: 'var(--c-rule)', color: 'var(--c-muted)' }}
            >
              <ImagePlus aria-hidden className="h-6 w-6" />
              <span>{t('photos.upload.drop')}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                {t('photos.upload.pick')}
              </Button>
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="photo-caption">{t('photos.upload.caption')}</Label>
            <Textarea
              id="photo-caption"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('photos.upload.captionPlaceholder')}
            />
            {caption ? (
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                {tokens.map((tok, i) =>
                  tok.kind === 'hashtag' ? (
                    <span key={i} style={{ color: 'var(--c-accent)' }}>
                      #{tok.value}
                    </span>
                  ) : tok.kind === 'mention' ? (
                    <span key={i} style={{ color: 'var(--c-accent-soft)' }}>
                      @{tok.value}
                    </span>
                  ) : (
                    <span key={i}>{tok.value}</span>
                  ),
                )}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t('photos.upload.taggedPeople')}</Label>
            {tagged.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {tagged.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-2 border bg-muted/30 py-1 pl-2 pr-1 text-xs"
                    style={{ borderColor: 'var(--c-rule)' }}
                  >
                    <Avatar
                      url={p.avatar_url}
                      fallback={`${p.first_name?.charAt(0) ?? ''}${p.last_name?.charAt(0) ?? ''}` || '?'}
                      size={20}
                    />
                    <span>{[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(p.user_id)}
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
              onChange={(e) => setTagQuery(e.target.value)}
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
                      onClick={() => addTag(r)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                    >
                      <Avatar
                        url={r.avatar_url}
                        fallback={`${r.first_name?.charAt(0) ?? ''}${r.last_name?.charAt(0) ?? ''}` || '?'}
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

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={upload.isPending}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!file || upload.isPending}
            onClick={() => void handleSubmit()}
          >
            {upload.isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('photos.upload.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
