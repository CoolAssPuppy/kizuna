import { AlertTriangle, ClipboardPaste, FlaskConical, Mail, Plane, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { cn } from '@/lib/utils';

import {
  importPerkBookingViaEdge,
  listPerkBookingsViaEdge,
  parseItineraryViaEdge,
  saveParsedAccommodations,
  saveParsedFlights,
  saveParsedTransfers,
  type PerkBookingSummary,
} from './importApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IANA timezone of the event venue, used as the fallback when an
   *  airport's timezone isn't in our static lookup. */
  eventTimezone: string;
  /** Called once parsed records have been saved into the database. */
  onImported: () => void;
}

type SourceTab = 'paste' | 'upload' | 'email' | 'perk';

const TAB_ICON: Record<SourceTab, typeof ClipboardPaste> = {
  paste: ClipboardPaste,
  upload: Upload,
  email: Mail,
  perk: Plane,
};

const TABS: ReadonlyArray<SourceTab> = ['paste', 'upload', 'email', 'perk'];

// Two flights only — round-trip to YYC for the dev flow. No hotel,
// rental, or shuttle so the smoke-test stays narrow.
const TEST_ITINERARY = `Outbound flight
American Airlines AA228
Friday January 8, 2027
SFO (San Francisco) departing 7:45am Pacific
YYC (Calgary) arriving 11:42am Mountain
Confirmation code: 4XQ2RT
Seat 14C, economy

Return flight
American Airlines AA229
Sunday January 17, 2027
YYC (Calgary) departing 11:15am Mountain
SFO (San Francisco) arriving 12:48pm Pacific
Confirmation code: 4XQ2RT
Seat 22A, economy`;

/**
 * Dialog for importing itinerary text. Phase 1 supports paste; upload
 * and email render a "coming soon" affordance so the design pattern is
 * already in place when those flows ship.
 */
export function ImportItineraryDialog({
  open,
  onOpenChange,
  eventTimezone,
  onImported,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<SourceTab>('paste');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  // Inline error message rendered directly in the dialog. Toasts alone
  // were too easy to miss when the user is focused on the textarea.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Perk picker state. We deliberately keep the listed bookings even
  // after a successful import so the user can come back and import a
  // sibling trip without re-listing.
  const [perkBookings, setPerkBookings] = useState<ReadonlyArray<PerkBookingSummary> | null>(null);
  const [perkImportingId, setPerkImportingId] = useState<string | null>(null);

  async function handlePerkList(): Promise<void> {
    if (!user) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await listPerkBookingsViaEdge();
      setPerkBookings(result.bookings);
      if (!result.found) {
        setErrorMessage(t('itinerary.import.perk.nothingFound'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`${t('itinerary.import.perk.error')} — ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePerkImport(bookingId: string): Promise<void> {
    setPerkImportingId(bookingId);
    setErrorMessage(null);
    try {
      const result = await importPerkBookingViaEdge(bookingId);
      const total = result.inserted + result.updated;
      show(t('itinerary.import.perk.success', { count: total }));
      onImported();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`${t('itinerary.import.perk.error')} — ${message}`);
    } finally {
      setPerkImportingId(null);
    }
  }

  async function handleParse(): Promise<void> {
    if (!pasted.trim() || !user) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await parseItineraryViaEdge(pasted.trim());
      const [flightCount, hotelCount, transferCount] = await Promise.all([
        saveParsedFlights(user.id, result.flights, eventTimezone),
        saveParsedAccommodations(user.id, result.hotels),
        saveParsedTransfers(user.id, result.car_services, result.rental_cars, eventTimezone),
      ]);
      const parsed =
        result.flights.length +
        result.hotels.length +
        result.rental_cars.length +
        result.car_services.length;
      const persisted = flightCount + hotelCount + transferCount;
      if (persisted === 0 && parsed === 0) {
        // Surface "we found nothing in this text" inline so the user
        // can decide whether to refine the paste or pick a different
        // booking confirmation.
        setErrorMessage(t('itinerary.import.nothingFound'));
        return;
      }
      show(t('itinerary.import.success', { count: persisted }));
      onImported();
      onOpenChange(false);
      setPasted('');
      setErrorMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Render the underlying server message verbatim. The parse-itinerary
      // edge function returns useful detail like "OPENAI_API_KEY missing"
      // or "you must provide a model parameter"; hiding it behind a
      // generic toast made debugging nearly impossible.
      setErrorMessage(`${t('itinerary.import.error')} — ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{t('itinerary.import.title')}</DialogTitle>
          <DialogDescription>{t('itinerary.import.subtitle')}</DialogDescription>
        </DialogHeader>

        <div role="tablist" className="flex border-b bg-muted/30 px-6">
          {TABS.map((id) => {
            const Icon = TAB_ICON[id];
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors',
                  active && 'border-primary text-foreground',
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {t(`itinerary.import.tabs.${id}`)}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-5">
          {tab === 'paste' ? (
            <div className="space-y-3">
              <Textarea
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                rows={10}
                placeholder={t('itinerary.import.pastePlaceholder')}
                aria-label={t('itinerary.import.tabs.paste')}
              />
              <p className="text-xs text-muted-foreground">{t('itinerary.import.pasteHint')}</p>
              {errorMessage ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="break-words">{errorMessage}</p>
                </div>
              ) : null}
            </div>
          ) : tab === 'perk' ? (
            <PerkPanel
              bookings={perkBookings}
              busy={busy}
              importingId={perkImportingId}
              errorMessage={errorMessage}
              onSync={() => void handlePerkList()}
              onImport={(id) => void handlePerkImport(id)}
            />
          ) : (
            <ComingSoon kind={tab} />
          )}
        </div>

        <DialogFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* "Add Test Itinerary" filler. Temporarily un-gated for
              prod demos — re-add `import.meta.env.DEV` before launch. */}
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center border-2 border-dashed border-purple-500 font-bold uppercase tracking-wide text-purple-700 hover:text-purple-900 sm:w-auto"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(168,85,247,0.18) 0 8px, transparent 8px 16px)',
            }}
            onClick={() => {
              setPasted(TEST_ITINERARY);
              setTab('paste');
              setErrorMessage(null);
            }}
          >
            <FlaskConical aria-hidden className="mr-2 h-4 w-4" />
            {t('itinerary.import.testItinerary')}
          </Button>
          <div className="flex w-full flex-row justify-end gap-2 sm:w-auto">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('actions.cancel')}
            </Button>
            {tab !== 'perk' ? (
              <Button
                onClick={() => void handleParse()}
                disabled={busy || tab !== 'paste' || pasted.trim().length === 0}
              >
                {busy ? t('itinerary.import.parsing') : t('itinerary.import.parse')}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComingSoon({ kind }: { kind: 'upload' | 'email' }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      <p className="font-medium">{t(`itinerary.import.${kind}ComingSoonTitle`)}</p>
      <p>{t(`itinerary.import.${kind}ComingSoonHint`)}</p>
    </div>
  );
}

interface PerkPanelProps {
  bookings: ReadonlyArray<PerkBookingSummary> | null;
  busy: boolean;
  importingId: string | null;
  errorMessage: string | null;
  onSync: () => void;
  onImport: (bookingId: string) => void;
}

/**
 * Two-step Perk picker:
 *  1. Pre-sync — explainer + "Sync now" button.
 *  2. Post-sync — list of bookings, each with its own Import button.
 *
 * Re-listing is always one click away ("Refresh"), and Import is
 * idempotent so a second click on the same booking just re-syncs the
 * latest flight times instead of creating duplicates.
 */
function PerkPanel({
  bookings,
  busy,
  importingId,
  errorMessage,
  onSync,
  onImport,
}: PerkPanelProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const dateRange = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const sameDay = startDate.toDateString() === endDate.toDateString();
    const fmt = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' });
    if (sameDay) return fmt.format(startDate);
    return `${fmt.format(startDate)} – ${fmt.format(endDate)}, ${endDate.getFullYear()}`;
  };

  return (
    <div className="space-y-3">
      {bookings === null ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/20 px-4 py-5 text-sm">
          <div>
            <p className="font-medium text-foreground">{t('itinerary.import.perk.title')}</p>
            <p className="mt-1 text-muted-foreground">{t('itinerary.import.perk.hint')}</p>
          </div>
          <Button onClick={onSync} disabled={busy}>
            {busy ? t('itinerary.import.perk.syncing') : t('itinerary.import.perk.sync')}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {bookings.length === 0
                ? t('itinerary.import.perk.nothingFound')
                : t('itinerary.import.perk.listHint', { count: bookings.length })}
            </p>
            <Button variant="ghost" size="sm" onClick={onSync} disabled={busy}>
              {busy ? t('itinerary.import.perk.syncing') : t('itinerary.import.perk.refresh')}
            </Button>
          </div>
          <ul className="space-y-2">
            {bookings.map((b) => {
              const importing = importingId === b.bookingId;
              return (
                <li
                  key={b.bookingId}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {b.tripName ?? `${b.origin} → ${b.destination}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.origin} → {b.destination} ·{' '}
                      {dateRange(b.earliestDeparture, b.latestArrival)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('itinerary.import.perk.legs', { count: b.segmentCount })}
                      {b.airlines.length > 0 ? ` · ${b.airlines.join(', ')}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onImport(b.bookingId)}
                    disabled={busy || importingId !== null}
                  >
                    {importing
                      ? t('itinerary.import.perk.importing')
                      : t('itinerary.import.perk.import')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="break-words">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
