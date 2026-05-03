// Edge function: sync-perk
//
// Two-step flow driven by the SPA's "Sync with Perk" tab:
//
//   * **List mode** — body `{}` (or no body): fetches every active
//     booking for the caller's email and returns a summary list.
//     The SPA renders these as a picker.
//   * **Import mode** — body `{ bookingId: string }`: re-fetches that
//     specific booking from Perk and upserts every segment as a
//     `public.flights` row keyed on
//     `(user_id, perk_booking_ref, flight_number, direction)`. Re-
//     imports are idempotent — a second sync of the same booking
//     updates existing rows in place rather than creating duplicates,
//     so the user can resync any time bookings change.
//
// Direction is derived from the active event's airport_iata + start
// time so the function stays event-agnostic.
//
// Stub mode (PERK_API_KEY missing) still completes the round-trip
// because perkClient swaps in deterministic fixtures.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { fetchPerkBookingById, listPerkBookingsForEmail } from '../_shared/perkClient.ts';
import type { PerkBooking, PerkFlightSegment } from '../_shared/perkStub.ts';
import { getAdminClient, getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: { env: { get: (k: string) => string | undefined } };

interface ActiveEventLite {
  id: string;
  airport_iata: string;
  start_at: string;
}

interface RequestBody {
  bookingId?: string;
}

/**
 * Lean summary the SPA's picker renders. We deliberately strip
 * back-end-only details (timezones, IATA carrier codes) — the user
 * picks by trip name and date range, not segment fan-out.
 */
interface BookingSummary {
  bookingId: string;
  tripName: string | null;
  segmentCount: number;
  origin: string;
  destination: string;
  earliestDeparture: string;
  latestArrival: string;
  airlines: ReadonlyArray<string>;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  const userClient = getUserClient(authHeader);
  const caller = await getCallerUser(userClient, authHeader);
  if (!caller) {
    return jsonResponse({ error: 'unauthenticated' }, { status: 401 });
  }
  const callerId = caller.id;
  const callerEmail = caller.email;
  if (!callerEmail) {
    return jsonResponse({ error: 'no_email' }, { status: 400 });
  }

  let body: RequestBody = {};
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      body = (await req.json()) as RequestBody;
    }
  } catch {
    body = {};
  }

  const apiKey = Deno.env.get('PERK_API_KEY');

  // --- List mode ---------------------------------------------------
  if (!body.bookingId) {
    let bookings: ReadonlyArray<PerkBooking>;
    try {
      bookings = await listPerkBookingsForEmail({ apiKey }, callerEmail);
    } catch (err) {
      return jsonResponse({ error: 'perk_fetch_failed', detail: String(err) }, { status: 502 });
    }
    return jsonResponse({
      mode: 'list',
      found: bookings.length > 0,
      bookings: bookings.map(toSummary),
    });
  }

  // --- Import mode -------------------------------------------------
  let booking;
  try {
    booking = await fetchPerkBookingById({ apiKey }, body.bookingId);
  } catch (err) {
    return jsonResponse({ error: 'perk_fetch_failed', detail: String(err) }, { status: 502 });
  }
  if (!booking) {
    return jsonResponse({ error: 'booking_not_found' }, { status: 404 });
  }
  // Defence in depth: a malicious caller cannot import another user's
  // booking because the booking's traveller email must match theirs.
  if (booking.travellerEmail.toLowerCase() !== callerEmail.toLowerCase()) {
    return jsonResponse({ error: 'booking_not_yours' }, { status: 403 });
  }

  const admin = getAdminClient();
  const event = await loadActiveEvent(admin);
  if (!event) {
    return jsonResponse({ error: 'no_active_event' }, { status: 409 });
  }
  const eventStart = new Date(event.start_at).getTime();

  let inserted = 0;
  let updated = 0;
  for (const seg of booking.segments) {
    const direction = inferDirection(seg, event.airport_iata, eventStart);
    const departureUtc = new Date(seg.departureLocal).toISOString();
    const arrivalUtc = new Date(seg.arrivalLocal).toISOString();

    const { data: existing } = await admin
      .from('flights')
      .select('id')
      .eq('user_id', callerId)
      .eq('perk_booking_ref', booking.bookingId)
      .eq('flight_number', seg.flightNumber)
      .eq('direction', direction)
      .maybeSingle();

    const payload = {
      user_id: callerId,
      perk_booking_ref: booking.bookingId,
      direction,
      origin: seg.origin,
      destination: seg.destination,
      departure_at: departureUtc,
      departure_tz: seg.departureTz,
      arrival_at: arrivalUtc,
      arrival_tz: seg.arrivalTz,
      airline: seg.airline,
      flight_number: seg.flightNumber,
      source: 'perk_sync' as const,
      is_confirmed: true,
      last_synced_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await admin
        .from('flights')
        .update(payload)
        .eq('id', existing.id);
      if (updateError) {
        return jsonResponse(
          { error: 'flight_update_failed', detail: updateError.message },
          { status: 500 },
        );
      }
      updated += 1;
    } else {
      const { error: insertError } = await admin.from('flights').insert(payload);
      if (insertError) {
        return jsonResponse(
          { error: 'flight_insert_failed', detail: insertError.message },
          { status: 500 },
        );
      }
      inserted += 1;
    }
  }

  return jsonResponse({
    mode: 'import',
    bookingId: booking.bookingId,
    inserted,
    updated,
  });
});

function toSummary(booking: PerkBooking): BookingSummary {
  const segments = booking.segments;
  // Sort defensively; Perk returns chronological but we don't depend
  // on it.
  const departures = segments.map((s) => new Date(s.departureLocal).getTime()).sort((a, b) => a - b);
  const arrivals = segments.map((s) => new Date(s.arrivalLocal).getTime()).sort((a, b) => a - b);
  const earliestDeparture = new Date(departures[0] ?? 0).toISOString();
  const latestArrival = new Date(arrivals[arrivals.length - 1] ?? 0).toISOString();

  // First leg's origin and last leg's destination paint the round
  // trip on the picker (e.g. "JFK → JFK" for a return). When the
  // booking is one-way the first/last differ.
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  const airlines = Array.from(new Set(segments.map((s) => s.airline)));

  return {
    bookingId: booking.bookingId,
    tripName: booking.tripName,
    segmentCount: segments.length,
    origin: first.origin,
    destination: last.destination,
    earliestDeparture,
    latestArrival,
    airlines,
  };
}

async function loadActiveEvent(
  admin: ReturnType<typeof getAdminClient>,
): Promise<ActiveEventLite | null> {
  const { data, error } = await admin
    .from('events')
    .select('id, airport_iata, start_at')
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as ActiveEventLite;
}

function inferDirection(
  seg: PerkFlightSegment,
  eventAirport: string,
  eventStartMs: number,
): 'inbound' | 'outbound' {
  const arrivalMs = new Date(seg.arrivalLocal).getTime();
  if (seg.destination === eventAirport && arrivalMs <= eventStartMs + 24 * 60 * 60 * 1000) {
    return 'inbound';
  }
  return 'outbound';
}
