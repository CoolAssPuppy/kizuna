// share-report edge function
//
// Public, anon-callable endpoint. Recipients (Fairmont, bus operator)
// hit this with a token in the path. We:
//   1. Look up report_snapshots by token. 404 if not found.
//   2. Honour share_expires_at. 410 if past expiry.
//   3. Fetch the report data live from the matching tables via service
//      role. Returns JSON with rows + last_modified.
//
// The spec is explicit: "shareable link always renders live data — not a
// frozen snapshot." This function is the live path.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (k: string) => string | undefined };
};

interface ShareSnapshot {
  id: string;
  event_id: string;
  report_type: string;
  share_expires_at: string | null;
  generated_at: string;
}

type ReportFetcher = (
  client: SupabaseClient,
  eventId: string,
) => Promise<{ rows: unknown[]; lastModified: string | null }>;

const FETCHERS: Record<string, ReportFetcher> = {
  rooming_list: async (client, eventId) => {
    const { data, error } = await client
      .from('accommodations')
      .select(
        `
        hotel_name, room_number, room_type, check_in, check_out,
        special_requests, updated_at,
        accommodation_occupants (
          is_primary,
          users (
            email,
            employee_profiles ( preferred_name, legal_name ),
            guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )
          )
        )
      `,
      )
      .eq('event_id', eventId)
      .order('hotel_name');
    if (error) throw error;
    const rows = (data ?? []).flatMap((room) => {
      const occupants = room.accommodation_occupants ?? [];
      const base = {
        hotel: room.hotel_name,
        room_number: room.room_number,
        room_type: room.room_type,
        check_in: room.check_in,
        check_out: room.check_out,
        special_requests: room.special_requests,
        last_modified: room.updated_at,
      };
      if (occupants.length === 0) {
        return [{ ...base, guest_name: '(unassigned)', guest_email: '' }];
      }
      return occupants.map((occ) => {
        const user = occ.users;
        const employee = user?.employee_profiles;
        const guest = user?.guest_profiles;
        const guestName = guest
          ? [guest.first_name, guest.last_name].filter(Boolean).join(' ').trim()
          : '';
        const name =
          employee?.preferred_name ?? employee?.legal_name ?? (guestName.length > 0 ? guestName : '');
        return {
          ...base,
          guest_name: name || (user?.email ?? ''),
          guest_email: user?.email ?? '',
          is_primary: occ.is_primary,
        };
      });
    });
    const lastModified = rows.reduce<string | null>((acc, r) => {
      const lm = (r as { last_modified?: string }).last_modified ?? null;
      if (lm && (!acc || lm > acc)) return lm;
      return acc;
    }, null);
    return { rows, lastModified };
  },

  transport_manifest: async (client, eventId) => {
    // transport_requests has no event_id of its own — scope through
    // the registrations table so a shareable link for Event A can't
    // leak rows from Event B.
    const eligibleUsers = await client
      .from('registrations')
      .select('user_id')
      .eq('event_id', eventId);
    if (eligibleUsers.error) throw eligibleUsers.error;
    const userIds = (eligibleUsers.data ?? []).map((r) => r.user_id);
    if (userIds.length === 0) {
      return { rows: [], lastModified: null };
    }
    const { data, error } = await client
      .from('transport_requests')
      .select(
        `
        direction, pickup_at, pickup_tz, passenger_count, bag_count,
        special_equipment, needs_review, updated_at,
        users ( email ),
        flights ( flight_number, airline, origin, destination ),
        transport_vehicles ( vehicle_name )
      `,
      )
      .in('user_id', userIds)
      .order('pickup_at');
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({
      direction: r.direction,
      pickup_at: r.pickup_at,
      pickup_tz: r.pickup_tz,
      email: r.users?.email ?? '',
      flight_number: r.flights?.flight_number ?? null,
      airline: r.flights?.airline ?? null,
      origin: r.flights?.origin ?? null,
      destination: r.flights?.destination ?? null,
      passenger_count: r.passenger_count,
      bag_count: r.bag_count,
      special_equipment: (r.special_equipment ?? []).join(', '),
      vehicle: r.transport_vehicles?.vehicle_name ?? null,
      needs_review: r.needs_review,
      last_modified: r.updated_at,
    }));
    const lastModified = rows.reduce<string | null>(
      (acc, r) => (!acc || r.last_modified > acc ? r.last_modified : acc),
      null,
    );
    return { rows, lastModified };
  },

  dietary_summary: async (client, _eventId) => {
    const { data, error } = await client
      .from('dietary_preferences')
      .select(`restrictions, allergies, alcohol_free, severity, notes, updated_at, users(email)`)
      .order('severity', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({
      email: r.users?.email ?? '',
      restrictions: (r.restrictions ?? []).join(', '),
      allergies: (r.allergies ?? []).join(', '),
      alcohol_free: r.alcohol_free,
      severity: r.severity,
      notes: r.notes,
      last_modified: r.updated_at,
    }));
    const lastModified = rows.reduce<string | null>(
      (acc, r) => (!acc || r.last_modified > acc ? r.last_modified : acc),
      null,
    );
    return { rows, lastModified };
  },
};

function urlToken(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const parts = url.pathname.split('/').filter(Boolean);
  // Path looks like /share-report/<token>
  return parts[parts.length - 1] ?? null;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const token = urlToken(req);
  if (!token || token === 'share-report') {
    return jsonResponse({ error: 'Missing token' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server not configured' }, { status: 500 });
  }
  const client: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: snapshotRow, error: snapErr } = await client
    .from('report_snapshots')
    .select('id, event_id, report_type, share_expires_at, generated_at')
    .eq('share_token', token)
    .maybeSingle();

  if (snapErr) {
    return jsonResponse({ error: snapErr.message }, { status: 500 });
  }
  if (!snapshotRow) {
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }
  const snapshot = snapshotRow as ShareSnapshot;
  if (snapshot.share_expires_at && snapshot.share_expires_at < new Date().toISOString()) {
    return jsonResponse({ error: 'Link expired' }, { status: 410 });
  }

  const fetcher = FETCHERS[snapshot.report_type];
  if (!fetcher) {
    return jsonResponse({ error: 'Report type not shareable' }, { status: 400 });
  }

  try {
    const { rows, lastModified } = await fetcher(client, snapshot.event_id);
    return new Response(
      JSON.stringify({
        report_type: snapshot.report_type,
        rows,
        last_modified: lastModified,
        share_expires_at: snapshot.share_expires_at,
        generated_at: snapshot.generated_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[share-report]', message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
