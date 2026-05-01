import { AlertTriangle, ClipboardPaste, Mail, Upload } from 'lucide-react';
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
  parseItineraryViaEdge,
  saveParsedAccommodations,
  saveParsedFlights,
  saveParsedTransfers,
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

type SourceTab = 'paste' | 'upload' | 'email';

const TAB_ICON: Record<SourceTab, typeof ClipboardPaste> = {
  paste: ClipboardPaste,
  upload: Upload,
  email: Mail,
};

const TABS: ReadonlyArray<SourceTab> = ['paste', 'upload', 'email'];

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
      <DialogContent className="gap-0 p-0">
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
          ) : (
            <ComingSoon kind={tab} />
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleParse()}
            disabled={busy || tab !== 'paste' || pasted.trim().length === 0}
          >
            {busy ? t('itinerary.import.parsing') : t('itinerary.import.parse')}
          </Button>
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
