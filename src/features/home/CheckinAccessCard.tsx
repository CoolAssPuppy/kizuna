import { ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { buildCheckinUrl } from '@/features/itinerary/checkinUrl';

interface Props {
  eventId: string;
  /**
   * Whether the QR is expanded on first render. Pass `true` during
   * event days so the user always lands on a visible code; pass
   * `false` outside the event window so it stays compact.
   */
  defaultOpen?: boolean;
}

/**
 * Compact "Event Access Code" card. Renders an in-page collapsible —
 * a chevron toggles the QR. The dialog version on the itinerary
 * screen uses the same URL payload.
 */
export function CheckinAccessCard({ eventId, defaultOpen = false }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  if (!user) return null;
  const url = buildCheckinUrl(user.id, eventId);
  return (
    <section
      aria-label={t('home.eventAccess.label')}
      className="rounded-xl border bg-card/60 p-4 text-card-foreground shadow-sm backdrop-blur"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`event-access-${eventId}`}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t('home.eventAccess.label')}
        </span>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open ? (
        <div
          id={`event-access-${eventId}`}
          className="mt-4 flex justify-center rounded-md bg-white p-3 shadow-inner"
        >
          <QRCodeSVG value={url} size={180} level="M" marginSize={1} />
        </div>
      ) : null}
    </section>
  );
}
