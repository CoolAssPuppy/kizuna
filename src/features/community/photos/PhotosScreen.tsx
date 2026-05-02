import { ArrowLeft, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActiveEvent } from '@/features/events/useActiveEvent';

import { type PhotoRecord } from './api';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoMasonry } from './PhotoMasonry';
import { PhotoUploadDialog } from './PhotoUploadDialog';
import { usePhotoSearch } from './hooks';

export function PhotosScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const { photoId } = useParams<{ photoId?: string }>();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(photoId ?? null);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    // Sync the lightbox's active photo with the URL param so back/forward
    // and direct permalinks both open the right photo.
    setActiveId(photoId ?? null);
  }, [photoId]);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    // Debounce the typed query so each keystroke doesn't fire a query.
    const id = window.setTimeout(() => setDebounced(query), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  const photosQ = usePhotoSearch(eventId, debounced);
  const photos: PhotoRecord[] = useMemo(() => photosQ.data ?? [], [photosQ.data]);

  function handleOpen(photo: PhotoRecord): void {
    setActiveId(photo.id);
    navigate(`/community/photos/${photo.id}`, { replace: true });
  }

  function handleClose(): void {
    setActiveId(null);
    navigate('/community/photos', { replace: true });
  }

  function handleChange(next: PhotoRecord | null): void {
    setActiveId(next?.id ?? null);
    if (next) navigate(`/community/photos/${next.id}`, { replace: true });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-10 sm:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6">
        <Link to="/community" className="inline-flex items-center gap-2">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('photos.screen.back')}
        </Link>
      </Button>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <TerminalEyebrow label="memories.archive" />
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight"
            style={{ color: 'var(--c-fg)' }}
          >
            {t('photos.screen.title', { event: event?.name ?? t('photos.section.fallbackEvent') })}
          </h1>
        </div>
        <Button type="button" className="gap-2 self-start" onClick={() => setUploadOpen(true)}>
          <Plus aria-hidden className="h-4 w-4" />
          {t('photos.section.add')}
        </Button>
      </header>

      <div
        className="sticky top-0 z-10 -mx-4 mb-6 px-4 py-3 sm:-mx-8 sm:px-8"
        style={{ backgroundColor: 'var(--c-bg)' }}
      >
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--c-muted)' }}
          />
          <Input
            type="search"
            placeholder={t('photos.screen.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {photosQ.isLoading ? (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--c-muted)' }}>
          {t('app.loading')}
        </p>
      ) : photos.length === 0 ? (
        <p
          className="border border-dashed p-12 text-center text-sm"
          style={{ borderColor: 'var(--c-rule)', color: 'var(--c-muted)' }}
        >
          {debounced ? t('photos.screen.searchEmpty') : t('photos.section.empty')}
        </p>
      ) : (
        <PhotoMasonry photos={photos} onOpen={handleOpen} />
      )}

      {eventId ? (
        <PhotoUploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          eventId={eventId}
        />
      ) : null}
      <PhotoLightbox
        photos={photos}
        activeId={activeId}
        onClose={handleClose}
        onChange={handleChange}
      />
    </main>
  );
}
