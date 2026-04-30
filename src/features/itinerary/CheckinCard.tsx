import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

import { useCheckinToken } from './useItinerary';

interface Props {
  eventId: string;
}

export function CheckinCard({ eventId }: Props): JSX.Element {
  const { t } = useTranslation();
  const { qrToken } = useCheckinToken({ eventId });

  return (
    <article className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center text-card-foreground shadow-sm">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{t('itinerary.checkin.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('itinerary.checkin.subtitle')}</p>
      </header>
      {qrToken ? (
        <QRCodeSVG value={qrToken} size={224} level="M" />
      ) : (
        <p className="text-sm text-muted-foreground">{t('itinerary.checkin.noToken')}</p>
      )}
    </article>
  );
}
