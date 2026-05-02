import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  eventId: string;
  eventName: string;
}

/**
 * Builds the QR payload as a deep link the venue scanner (and any
 * iPhone Camera app) can resolve. The user_id UUID alone is enough
 * to uniquely identify the attendee — name and city are display
 * attributes the scanner pulls from the DB once it has the id.
 */
function buildCheckinUrl(userId: string, eventId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://kizuna.dev';
  return `${origin}/check-in?u=${encodeURIComponent(userId)}&e=${encodeURIComponent(eventId)}`;
}

/**
 * QR icon button + responsive sheet/dialog with the user's check-in
 * code. Dialog on >= sm breakpoint, bottom-sheet styling on mobile —
 * one Radix Dialog, two layout variants. Centered modal on desktop,
 * slide-up sheet on mobile via Tailwind responsive overrides.
 */
export function CheckinQrDialog({ eventId, eventName }: Props): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('itinerary.checkin.openLabel')}
        className={cn(
          'group inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border bg-card text-card-foreground shadow-sm',
          'transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <QrCode
          aria-hidden
          className="h-10 w-10 text-primary transition-transform group-hover:scale-110"
        />
      </button>

      <DialogContent
        className={cn(
          // Mobile: slide-up sheet pinned to the bottom edge.
          'bottom-0 left-0 top-auto max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl',
          // Desktop: classic centered modal (overrides sit on top of the
          // shadcn defaults via tailwind-merge).
          'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
        )}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <DialogTitle className="text-xl">
            {t('itinerary.checkin.welcome', { event: eventName })}
          </DialogTitle>

          {user ? (
            <div className="rounded-xl bg-white p-4 shadow-inner">
              <QRCodeSVG
                value={buildCheckinUrl(user.id, eventId)}
                size={256}
                level="M"
                marginSize={1}
              />
            </div>
          ) : (
            <div
              className="flex h-[280px] w-[280px] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
              role="status"
            >
              {t('itinerary.checkin.signInRequired')}
            </div>
          )}

          <p className="text-sm text-muted-foreground">{t('itinerary.checkin.body')}</p>

          <ProfileAvatar size={72} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
