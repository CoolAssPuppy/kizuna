import { ChevronLeft, ChevronRight, Link as LinkIcon, Trash2, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useIsAdmin } from '@/features/auth/hooks';
import { useStorageImage } from '@/lib/useStorageImage';

import { PHOTOS_BUCKET, type PhotoRecord } from './api';
import { useSoftDeletePhoto } from './hooks';

interface Props {
  photos: ReadonlyArray<PhotoRecord>;
  activeId: string | null;
  onClose: () => void;
  onChange: (next: PhotoRecord | null) => void;
}

export function PhotoLightbox({ photos, activeId, onClose, onChange }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const softDelete = useSoftDeletePhoto();
  const index = useMemo(() => photos.findIndex((p) => p.id === activeId), [photos, activeId]);
  const photo = index >= 0 ? photos[index] : null;
  const previewPath = photo ? `${photo.storage_prefix}/preview.webp` : null;
  const url = useStorageImage(PHOTOS_BUCKET, previewPath);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    // Re-bind whenever the active photo or its neighbours change so the
    // arrow-key handler always navigates relative to the current index.
    if (!photo) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') {
        if (index < photos.length - 1) onChange(photos[index + 1] ?? null);
      }
      if (e.key === 'ArrowLeft') {
        if (index > 0) onChange(photos[index - 1] ?? null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photo, index, photos, onChange, onClose]);

  if (!photo) return null;

  async function handleCopyLink(): Promise<void> {
    if (!photo) return;
    const url = `${window.location.origin}/community/photos/${photo.id}`;
    try {
      await navigator.clipboard.writeText(url);
      show(t('photos.lightbox.copied'));
    } catch {
      show(t('photos.lightbox.copyFailed'), 'error');
    }
  }

  async function handleDelete(): Promise<void> {
    if (!photo) return;
    if (!window.confirm(t('photos.lightbox.deleteConfirm'))) return;
    try {
      await softDelete.mutateAsync(photo.id);
      show(t('photos.lightbox.deleted'));
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : t('photos.lightbox.deleteFailed'), 'error');
    }
  }

  const canDelete = !!user && (photo.uploader_id === user.id || isAdmin);
  const uploaderName = photo.uploader
    ? [photo.uploader.first_name, photo.uploader.last_name].filter(Boolean).join(' ') ||
      photo.uploader.email
    : '';

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-6xl border-0 bg-black/95 p-0 text-white">
        <div className="relative grid grid-cols-1 gap-0 lg:grid-cols-[1fr_320px]">
          <div className="relative flex min-h-[50vh] items-center justify-center">
            {url ? (
              <img
                src={url}
                alt={photo.caption ?? ''}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            ) : null}
            {index > 0 ? (
              <button
                type="button"
                onClick={() => onChange(photos[index - 1] ?? null)}
                aria-label={t('photos.lightbox.prev')}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80"
              >
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </button>
            ) : null}
            {index < photos.length - 1 ? (
              <button
                type="button"
                onClick={() => onChange(photos[index + 1] ?? null)}
                aria-label={t('photos.lightbox.next')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80"
              >
                <ChevronRight aria-hidden className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('photos.lightbox.close')}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-2 hover:bg-black/80"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>

          <aside className="space-y-4 border-l border-white/10 p-5 text-sm">
            <header className="flex items-start gap-3">
              {photo.uploader ? (
                <Link
                  to={`/community/p/${photo.uploader.user_id}`}
                  className="flex items-center gap-2 hover:opacity-80"
                  onClick={onClose}
                >
                  <Avatar
                    url={photo.uploader.avatar_url}
                    fallback={
                      `${photo.uploader.first_name?.charAt(0) ?? ''}${photo.uploader.last_name?.charAt(0) ?? ''}` ||
                      '?'
                    }
                    size={32}
                  />
                  <div>
                    <p className="font-medium">{uploaderName}</p>
                    <p className="text-xs text-white/60">
                      {new Date(photo.created_at).toLocaleString()}
                    </p>
                  </div>
                </Link>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/10"
                  aria-label={t('photos.lightbox.copyLink')}
                  onClick={() => void handleCopyLink()}
                >
                  <LinkIcon aria-hidden className="h-4 w-4" />
                </Button>
                {canDelete ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/10"
                    aria-label={t('photos.lightbox.delete')}
                    onClick={() => void handleDelete()}
                    disabled={softDelete.isPending}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </header>

            {photo.caption ? (
              <p className="whitespace-pre-line leading-relaxed">{photo.caption}</p>
            ) : null}

            {photo.hashtags.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {photo.hashtags.map((tag) => (
                  <li key={tag} className="rounded-full border border-white/20 px-2 py-0.5 text-xs">
                    #{tag}
                  </li>
                ))}
              </ul>
            ) : null}

            {photo.tagged.length > 0 ? (
              <section>
                <p className="text-xs uppercase tracking-wider text-white/60">
                  {t('photos.lightbox.tagged')}
                </p>
                <ul className="mt-2 space-y-2">
                  {photo.tagged.map((person) => (
                    <li key={person.user_id}>
                      <Link
                        to={`/community/p/${person.user_id}`}
                        className="flex items-center gap-2 hover:opacity-80"
                        onClick={onClose}
                      >
                        <Avatar
                          url={person.avatar_url}
                          fallback={
                            `${person.first_name?.charAt(0) ?? ''}${person.last_name?.charAt(0) ?? ''}` ||
                            '?'
                          }
                          size={24}
                        />
                        <span>
                          {[person.first_name, person.last_name].filter(Boolean).join(' ') ||
                            person.email}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
