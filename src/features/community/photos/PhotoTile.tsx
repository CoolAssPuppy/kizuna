import { useStorageImage } from '@/lib/useStorageImage';

import { PHOTOS_BUCKET, type PhotoRecord } from './api';

interface Props {
  photo: PhotoRecord;
  onOpen: (photo: PhotoRecord) => void;
}

export function PhotoTile({ photo, onOpen }: Props): JSX.Element {
  const url = useStorageImage(PHOTOS_BUCKET, `${photo.storage_prefix}/thumb.webp`);
  const ratio = photo.width && photo.height ? photo.height / photo.width : 1;
  const captionPreview = photo.caption?.slice(0, 80);
  return (
    <button
      type="button"
      onClick={() => onOpen(photo)}
      className="group relative mb-3 block w-full break-inside-avoid overflow-hidden border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ borderColor: 'var(--c-rule)', backgroundColor: 'var(--c-surface)' }}
      aria-label={photo.caption ?? `photo ${photo.id}`}
    >
      <div style={{ aspectRatio: `${1} / ${ratio || 1}` }} className="w-full">
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
      </div>
      {captionPreview ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-black/65 p-3 text-xs text-white transition-transform group-hover:translate-y-0">
          {captionPreview}
          {photo.caption && photo.caption.length > 80 ? '…' : ''}
        </div>
      ) : null}
    </button>
  );
}
