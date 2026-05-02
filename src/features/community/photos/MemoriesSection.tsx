import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { Button } from '@/components/ui/button';

import { type PhotoRecord } from './api';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoMasonry } from './PhotoMasonry';
import { PhotoUploadDialog } from './PhotoUploadDialog';
import { useRecentPhotos } from './hooks';

interface Props {
  eventId: string;
  eventName: string | null;
  /** Optional initial photo to open in the lightbox (used by permalinks). */
  initialPhotoId?: string | null;
}

export function MemoriesSection({ eventId, eventName, initialPhotoId = null }: Props): JSX.Element {
  const { t } = useTranslation();
  const photosQ = useRecentPhotos(eventId, 20);
  const photos: PhotoRecord[] = photosQ.data ?? [];
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initialPhotoId);

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <TerminalEyebrow
            label={`${(eventName ?? 'kizuna').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.memories`}
            trailing={photos.length > 0 ? `${photos.length} ${t('photos.section.recent')}` : undefined}
          />
          <h2
            className="mt-2 text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--c-fg)' }}
          >
            {t('photos.section.title', { event: eventName ?? t('photos.section.fallbackEvent') })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/community/photos">{t('photos.section.viewAll')}</Link>
          </Button>
          <Button type="button" size="sm" className="gap-2" onClick={() => setUploadOpen(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            {t('photos.section.add')}
          </Button>
        </div>
      </header>

      {photos.length === 0 ? (
        <p
          className="border border-dashed p-8 text-center text-sm"
          style={{ borderColor: 'var(--c-rule)', color: 'var(--c-muted)' }}
        >
          {t('photos.section.empty')}
        </p>
      ) : (
        <PhotoMasonry photos={photos} onOpen={(p) => setActiveId(p.id)} />
      )}

      <PhotoUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} eventId={eventId} />
      <PhotoLightbox
        photos={photos}
        activeId={activeId}
        onClose={() => setActiveId(null)}
        onChange={(next) => setActiveId(next?.id ?? null)}
      />
    </section>
  );
}
