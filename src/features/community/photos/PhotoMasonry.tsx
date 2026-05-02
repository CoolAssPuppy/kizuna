import type { PhotoRecord } from './api';
import { PhotoTile } from './PhotoTile';

interface Props {
  photos: ReadonlyArray<PhotoRecord>;
  onOpen: (photo: PhotoRecord) => void;
}

/**
 * CSS-columns masonry. Five columns at >= 1280px, scales down to one
 * column on phones. Each tile uses `break-inside: avoid` so the column
 * layout never splits a card.
 */
export function PhotoMasonry({ photos, onOpen }: Props): JSX.Element | null {
  if (photos.length === 0) return null;
  return (
    <div
      className="columns-1 gap-3 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5"
      style={{ columnFill: 'balance' }}
    >
      {photos.map((p) => (
        <PhotoTile key={p.id} photo={p} onOpen={onOpen} />
      ))}
    </div>
  );
}
