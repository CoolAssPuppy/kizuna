import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';

import {
  importPerkBookingViaEdge,
  listPerkBookingsViaEdge,
  parseItineraryViaEdge,
  saveParsedAccommodations,
  saveParsedFlights,
  saveParsedTransfers,
  type PerkBookingSummary,
} from './api';

/**
 * State machine for the itinerary import dialog. Owns the parse / save
 * round-trip for pasted text and the Perk picker. Pulled out of
 * ImportItineraryDialog so the dialog can be presentation-only and the
 * happy/sad paths can be unit-tested without mounting the modal.
 */

interface UseItineraryImportArgs {
  /** IANA timezone of the event venue, used as the fallback when an
   *  airport's timezone isn't in our static lookup. */
  eventTimezone: string;
  /** Called once parsed records have been saved into the database. */
  onImported: () => void;
}

export interface UseItineraryImportResult {
  pasted: string;
  setPasted: (next: string) => void;
  busy: boolean;
  errorMessage: string | null;
  clearError: () => void;
  /** Parse the textarea and persist. Returns true when the dialog
   *  should close (full success). */
  importPasted: () => Promise<boolean>;
  /** Perk picker state. */
  perkBookings: ReadonlyArray<PerkBookingSummary> | null;
  perkImportingId: string | null;
  listPerk: () => Promise<void>;
  /** Returns true on success so the caller can close the dialog. */
  importPerk: (bookingId: string) => Promise<boolean>;
}

export function useItineraryImport(args: UseItineraryImportArgs): UseItineraryImportResult {
  const { eventTimezone, onImported } = args;
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();

  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [perkBookings, setPerkBookings] = useState<ReadonlyArray<PerkBookingSummary> | null>(null);
  const [perkImportingId, setPerkImportingId] = useState<string | null>(null);

  function withErrorMessage(prefixKey: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    // The underlying server message ("OPENAI_API_KEY missing", "you
    // must provide a model parameter") is far more useful than a
    // generic toast — preserve it verbatim.
    setErrorMessage(`${t(prefixKey)} — ${message}`);
  }

  async function listPerk(): Promise<void> {
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
      withErrorMessage('itinerary.import.perk.error', err);
    } finally {
      setBusy(false);
    }
  }

  async function importPerk(bookingId: string): Promise<boolean> {
    setPerkImportingId(bookingId);
    setErrorMessage(null);
    try {
      const result = await importPerkBookingViaEdge(bookingId);
      const total = result.inserted + result.updated;
      show(t('itinerary.import.perk.success', { count: total }));
      onImported();
      return true;
    } catch (err) {
      withErrorMessage('itinerary.import.perk.error', err);
      return false;
    } finally {
      setPerkImportingId(null);
    }
  }

  async function importPasted(): Promise<boolean> {
    if (!pasted.trim() || !user) return false;
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
        setErrorMessage(t('itinerary.import.nothingFound'));
        return false;
      }
      show(t('itinerary.import.success', { count: persisted }));
      onImported();
      setPasted('');
      return true;
    } catch (err) {
      withErrorMessage('itinerary.import.error', err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    pasted,
    setPasted,
    busy,
    errorMessage,
    clearError: () => setErrorMessage(null),
    importPasted,
    perkBookings,
    perkImportingId,
    listPerk,
    importPerk,
  };
}
