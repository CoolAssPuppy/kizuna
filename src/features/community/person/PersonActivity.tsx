import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';
import { useStorageImage } from '@/lib/useStorageImage';

import { type PhotoRecord, PHOTOS_BUCKET } from '../photos/api';

interface MessageRow {
  id: string;
  channel: string;
  body: string;
  sent_at: string;
}

/**
 * Recent channel messages a person posted. Hidden when there's nothing
 * to show so the layout collapses cleanly for guests / new joiners.
 */
export function MessagesActivity({
  messages,
}: {
  messages: ReadonlyArray<MessageRow>;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (messages.length === 0) return null;
  return (
    <section
      className="border p-6"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <TerminalEyebrow label="recent.messages" />
      <ul className="mt-3 space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className="border-b pb-3 last:border-0 last:pb-0"
            style={{ borderColor: 'var(--c-rule)' }}
          >
            <Link to={`/community/channels/${m.channel}`} className="block hover:opacity-80">
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>
                #{m.channel} · {new Date(m.sent_at).toLocaleDateString()}
              </p>
              <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--c-fg)' }}>
                {m.body}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs" style={{ color: 'var(--c-muted)' }}>
        {t('community.person.activity.messagesHint')}
      </p>
    </section>
  );
}

/** Photos this person uploaded or was tagged in, as a thumbnail grid. */
export function PhotosActivity({
  photos,
}: {
  photos: ReadonlyArray<PhotoRecord>;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (photos.length === 0) return null;
  return (
    <section>
      <TerminalEyebrow
        label={`photos · ${photos.length}`}
        trailing={t('community.person.activity.photosTrailing')}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {photos.map((photo) => (
          <PhotoActivityTile key={photo.id} photo={photo} />
        ))}
      </div>
    </section>
  );
}

function PhotoActivityTile({ photo }: { photo: PhotoRecord }): JSX.Element {
  const url = useStorageImage(PHOTOS_BUCKET, `${photo.storage_prefix}/thumb.webp`);
  return (
    <Link
      to={`/community/photos/${photo.id}`}
      className="block aspect-square overflow-hidden border"
      style={{ borderColor: 'var(--c-rule)', backgroundColor: 'var(--c-surface)' }}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}
    </Link>
  );
}
