import { ClipboardPaste, Mail, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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

/**
 * Lightweight dialog (no Radix dependency) for importing itinerary text.
 * Phase 1 supports paste; upload and email are surfaced as "soon" so the
 * design pattern is in place and the feature flag can flip later.
 */
export function ImportItineraryDialog({
  open,
  onOpenChange,
  eventTimezone,
  onImported,
}: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<SourceTab>('paste');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function handleParse(): Promise<void> {
    if (!pasted.trim() || !user) return;
    setBusy(true);
    try {
      const result = await parseItineraryViaEdge(pasted.trim());
      const [flightCount, hotelCount, transferCount] = await Promise.all([
        saveParsedFlights(user.id, result.flights, eventTimezone),
        saveParsedAccommodations(user.id, result.hotels),
        saveParsedTransfers(user.id, result.car_services, result.rental_cars, eventTimezone),
      ]);
      const parsed =
        result.flights.length
        + result.hotels.length
        + result.rental_cars.length
        + result.car_services.length;
      const persisted = flightCount + hotelCount + transferCount;
      if (persisted === 0 && parsed === 0) {
        show(t('itinerary.import.nothingFound'), 'error');
      } else {
        show(t('itinerary.import.success', { count: persisted }));
        onImported();
        onOpenChange(false);
        setPasted('');
      }
    } catch {
      show(t('itinerary.import.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-itinerary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
    >
      {/* Backdrop is a separate button so keyboard users get an explicit close affordance */}
      <button
        type="button"
        aria-label={t('actions.close')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 cursor-default focus:outline-none"
      />
      <div className="kizuna-fade-in relative w-full max-w-2xl overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div className="space-y-1">
            <h2 id="import-itinerary-title" className="text-lg font-semibold">
              {t('itinerary.import.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('itinerary.import.subtitle')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t('actions.close')}
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </header>

        <div role="tablist" className="flex border-b bg-muted/30 px-6">
          {(['paste', 'upload', 'email'] as const).map((id) => {
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
            </div>
          ) : null}

          {tab === 'upload' ? <ComingSoon kind="upload" /> : null}
          {tab === 'email' ? <ComingSoon kind="email" /> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleParse()}
            disabled={busy || tab !== 'paste' || pasted.trim().length === 0}
          >
            {busy ? t('itinerary.import.parsing') : t('itinerary.import.parse')}
          </Button>
        </footer>
      </div>
    </div>
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
