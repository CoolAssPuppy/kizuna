import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { type PhotoRecord, PHOTOS_BUCKET } from '@/features/community/photos/api';
import { useRecentPhotos } from '@/features/community/photos/hooks';
import { useRealtimeInvalidation } from '@/lib/useRealtimeInvalidation';
import { useStorageImage } from '@/lib/useStorageImage';

interface Props {
  eventId: string;
  eventName: string | null;
}

const LIMIT = 10;
const EXIT_MS = 360;

export function HomeMemoriesSection({ eventId, eventName }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const photosQ = useRecentPhotos(eventId, LIMIT);

  // Live updates: any insert/update/delete on event_photos for this
  // event refetches the latest 10. Tagging changes do not change the
  // photo set, so we don't subscribe to event_photo_tags here.
  const realtimeBindings = useMemo(
    () => [
      {
        table: 'event_photos',
        invalidates: ['community', 'photos', 'recent', eventId, LIMIT] as const,
        filter: `event_id=eq.${eventId}`,
      },
    ],
    [eventId],
  );
  useRealtimeInvalidation(realtimeBindings);

  const photos = photosQ.data ?? [];
  const morphed = useMorphingPhotos(photos);

  if (photos.length === 0 && !photosQ.isLoading) return null;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {t('photos.section.title', { event: eventName ?? t('photos.section.fallbackEvent') })}
        </h2>
        <Link
          to="/community"
          className="inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: 'var(--c-accent)' }}
        >
          {t('home.memories.cta', {
            event: eventName ?? t('photos.section.fallbackEvent'),
          })}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </header>

      <ul className="flex flex-wrap gap-2">
        {morphed.map(({ photo, leaving }) => (
          <li key={photo.id} className="shrink-0">
            <SmallTile photo={photo} leaving={leaving} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface MorphedItem {
  photo: PhotoRecord;
  leaving: boolean;
}

/**
 * Keeps recently-removed photos around for EXIT_MS so the small tile
 * fades out before unmounting. New photos enter via the standard
 * kizuna-fade-in utility.
 */
function useMorphingPhotos(photos: ReadonlyArray<PhotoRecord>): MorphedItem[] {
  const [items, setItems] = useState<MorphedItem[]>(() =>
    photos.map((p) => ({ photo: p, leaving: false })),
  );
  const timersRef = useRef(new Map<string, number>());

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    setItems((prev) => {
      const incomingIds = new Set(photos.map((p) => p.id));
      const exiting = prev.filter((it) => !incomingIds.has(it.photo.id));
      const remaining = prev.filter((it) => incomingIds.has(it.photo.id));
      const known = new Set(prev.map((it) => it.photo.id));
      const arrivals = photos
        .filter((p) => !known.has(p.id))
        .map((p) => ({ photo: p, leaving: false }));

      // Schedule unmount for newly-exiting photos.
      for (const it of exiting) {
        if (timersRef.current.has(it.photo.id)) continue;
        const id = window.setTimeout(() => {
          setItems((current) => current.filter((item) => item.photo.id !== it.photo.id));
          timersRef.current.delete(it.photo.id);
        }, EXIT_MS);
        timersRef.current.set(it.photo.id, id);
      }

      // Cancel any pending removal for ids that came back.
      for (const it of remaining) {
        const timer = timersRef.current.get(it.photo.id);
        if (timer) {
          window.clearTimeout(timer);
          timersRef.current.delete(it.photo.id);
        }
      }

      return [
        ...arrivals,
        ...remaining.map((it) => ({ ...it, leaving: false, photo: photos.find((p) => p.id === it.photo.id) ?? it.photo })),
        ...exiting.map((it) => ({ ...it, leaving: true })),
      ];
    });
  }, [photos]);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  return items;
}

interface SmallTileProps {
  photo: PhotoRecord;
  leaving: boolean;
}

// Fixed square tile so 60% smaller is exact and predictable. The
// flex-wrap parent lets rows pack as many as fit per row at any
// breakpoint.
const TILE_PX = 96;

function SmallTile({ photo, leaving }: SmallTileProps): JSX.Element {
  const url = useStorageImage(PHOTOS_BUCKET, `${photo.storage_prefix}/thumb.webp`);
  return (
    <Link
      to={`/community/photos/${photo.id}`}
      className="block overflow-hidden border"
      style={{
        width: TILE_PX,
        height: TILE_PX,
        borderColor: 'var(--c-rule)',
        backgroundColor: 'var(--c-surface)',
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'scale(0.92)' : 'scale(1)',
        transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease`,
        animation: leaving ? undefined : 'kizuna-fade-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption ?? ''}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: 'var(--c-rule)' }} />
      )}
    </Link>
  );
}
