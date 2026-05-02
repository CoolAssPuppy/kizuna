import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { buildCheckinUrl } from '@/features/itinerary/checkinUrl';

interface Props {
  eventId: string;
}

/**
 * Compact "Event Access Code" card for the home sidebar — sits right
 * under the countdown so the user always has their entry QR within
 * one glance. Uses the same URL payload as the dialog version on the
 * itinerary screen.
 */
export function CheckinAccessCard({ eventId }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;
  const url = buildCheckinUrl(user.id, eventId);
  return (
    <section
      aria-label={t('home.eventAccess.label')}
      className="flex flex-col items-center gap-3 rounded-xl border bg-card/60 p-4 text-card-foreground shadow-sm backdrop-blur"
    >
      <p className="self-start text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {t('home.eventAccess.label')}
      </p>
      <div className="rounded-md bg-white p-3 shadow-inner">
        <QRCodeSVG value={url} size={180} level="M" marginSize={1} />
      </div>
    </section>
  );
}
