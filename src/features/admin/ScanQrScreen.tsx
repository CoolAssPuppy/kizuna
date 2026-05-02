import { useQuery } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useMountEffect } from '@/hooks/useMountEffect';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { fetchScannedAttendee, parseCheckinPayload } from './scan/scannerApi';

const SCANNER_ELEMENT_ID = 'kizuna-admin-scanner';

type ScanResult =
  | { kind: 'invalid'; raw: string }
  | { kind: 'ok'; userId: string; eventId: string };

/**
 * Admin door-staff QR scanner. Opens the camera (rear-facing on
 * mobile), watches for QR codes, and surfaces an Approval dialog
 * with the matched attendee's name + photo. Door staff visually
 * confirm "yes that's the person on screen" before waving them in.
 *
 * The scanner pauses while the dialog is open and resumes when it
 * closes — keeps a single camera stream alive across many scans
 * rather than tearing down/reinitialising the MediaStream each time.
 */
export function ScanQrScreen(): JSX.Element {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  // Camera lifecycle. React 18 Strict Mode double-fires this effect in
  // dev, so we have to be tolerant of `start` resolving after the
  // cleanup ran. The `cancelled` flag guards every async path; the
  // started flag tells the cleanup whether stop() will succeed.
  useMountEffect(() => {
    let cancelled = false;
    let started = false;
    let scanner: Html5Qrcode | null = null;

    void (async () => {
      try {
        scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, /* verbose */ false);
        if (cancelled) return;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decoded) => {
            if (cancelled) return;
            const payload = parseCheckinPayload(decoded);
            if (payload) {
              setResult({ kind: 'ok', userId: payload.userId, eventId: payload.eventId });
            } else {
              setResult({ kind: 'invalid', raw: decoded });
            }
            try {
              scanner?.pause(true);
            } catch {
              /* already paused */
            }
          },
          undefined,
        );
        if (cancelled) {
          // The unmount fired while start() was awaiting; tear down now.
          try {
            await scanner.stop();
          } catch {
            /* never reached running state */
          }
          return;
        }
        started = true;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : t('admin.scanQr.cameraFailed');
        setCameraError(message);
      }
    })();

    return () => {
      cancelled = true;
      const current = scanner;
      scannerRef.current = null;
      if (!current || !started) return;
      void current
        .stop()
        .catch(() => {
          /* not running */
        })
        .then(() => {
          try {
            current.clear();
          } catch {
            /* nothing to clear */
          }
        });
    };
  });

  function dismissResult(): void {
    setResult(null);
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      scanner.resume();
    } catch {
      /* not paused */
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ScanLine aria-hidden className="h-6 w-6 text-primary" />
          {t('admin.scanQr.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('admin.scanQr.subtitle')}</p>
      </header>

      {cameraError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {t('admin.scanQr.permission')}{' '}
          <span className="mt-1 block opacity-70">{cameraError}</span>
        </div>
      ) : null}

      <div
        id={SCANNER_ELEMENT_ID}
        className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border bg-black"
      />

      <ScanResultDialog result={result} onClose={dismissResult} />
    </section>
  );
}

interface ScanResultDialogProps {
  result: ScanResult | null;
  onClose: () => void;
}

function ScanResultDialog({ result, onClose }: ScanResultDialogProps): JSX.Element {
  const { t } = useTranslation();
  const userId = result?.kind === 'ok' ? result.userId : null;

  const attendeeQuery = useQuery({
    queryKey: ['admin', 'scan', 'attendee', userId],
    enabled: !!userId,
    queryFn: () => {
      if (!userId) return Promise.resolve(null);
      return fetchScannedAttendee(getSupabaseClient(), userId);
    },
  });

  const open = result !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        className={cn(
          'bottom-0 left-0 top-auto max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl',
          'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
        )}
      >
        {result?.kind === 'invalid' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <XCircle aria-hidden className="h-10 w-10" />
            </span>
            <DialogTitle className="text-xl">{t('admin.scanQr.invalid')}</DialogTitle>
            <p className="break-all text-xs text-muted-foreground">{result.raw}</p>
            <Button onClick={onClose}>{t('admin.scanQr.scanAnother')}</Button>
          </div>
        ) : null}

        {result?.kind === 'ok' && attendeeQuery.isPending ? (
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            {t('admin.scanQr.lookingUp')}
          </div>
        ) : null}

        {result?.kind === 'ok' && attendeeQuery.isSuccess && attendeeQuery.data ? (
          <ApprovalView attendee={attendeeQuery.data} onClose={onClose} />
        ) : null}

        {result?.kind === 'ok' && attendeeQuery.isSuccess && !attendeeQuery.data ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <XCircle aria-hidden className="h-10 w-10" />
            </span>
            <DialogTitle className="text-xl">{t('admin.scanQr.userNotFound')}</DialogTitle>
            <Button onClick={onClose}>{t('admin.scanQr.scanAnother')}</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface ApprovalViewProps {
  attendee: {
    displayName: string;
    avatarSignedUrl: string | null;
    baseCity: string | null;
  };
  onClose: () => void;
}

function ApprovalView({ attendee, onClose }: ApprovalViewProps): JSX.Element {
  const { t } = useTranslation();
  const initials = attendee.displayName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <CheckCircle2 aria-hidden className="h-10 w-10 animate-pulse" />
      </span>
      <DialogTitle className="text-2xl text-emerald-600">{t('admin.scanQr.approved')}</DialogTitle>

      {attendee.avatarSignedUrl ? (
        <img
          src={attendee.avatarSignedUrl}
          alt={attendee.displayName}
          className="h-32 w-32 rounded-full object-cover ring-4 ring-emerald-500/20"
        />
      ) : (
        <span className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-secondary-foreground ring-4 ring-emerald-500/20">
          {initials || '?'}
        </span>
      )}

      <div className="space-y-1">
        <p className="text-lg font-semibold">{attendee.displayName}</p>
        {attendee.baseCity ? (
          <p className="text-sm text-muted-foreground">{attendee.baseCity}</p>
        ) : null}
      </div>

      <Button onClick={onClose} className="w-full sm:w-auto">
        {t('admin.scanQr.scanAnother')}
      </Button>
    </div>
  );
}
