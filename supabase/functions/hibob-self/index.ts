// Edge function: hibob-self
//
// Called by the SPA right after the SSO sign-in completes. The function:
//   1. Authenticates the caller using their Supabase JWT (no admin guard
//      needed — every signed-in user is allowed to hydrate THEIR OWN
//      employee_profiles row from HiBob).
//   2. Reads the caller's email from auth.users.
//   3. Looks up the employee in HiBob via POST /v1/people/search using
//      the service-user credential.
//   4. Upserts employee_profiles with the result. Fields the user has
//      already overridden carry _source = 'user_entered' / _locked = true
//      and are skipped (the existing reconcile logic handles that
//      contract).
//   5. Upserts swag_sizes with HiBob's t-shirt and shoe size when
//      present.
//   6. Returns the hydrated shape so the SPA can route to the
//      registration wizard with the form pre-filled.
//
// In stubbed mode (HIBOB_SERVICE_USER_ID / TOKEN absent) the function
// returns deterministic data from a small hard-coded map. This lets us
// run the full SSO -> HiBob -> wizard flow locally without any HiBob
// tenant.
//
// IMPORTANT: this function does NOT proxy arbitrary HiBob requests.
// Every read is keyed on auth.email so a caller can only hydrate their
// own profile. Do not generalise without re-thinking the trust model.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { HIBOB_STUB_BY_EMAIL, type HiBobStubPerson } from '../_shared/hibobStub.ts';
import { getAdminClient, getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: { env: { get: (k: string) => string | undefined } };

const HIBOB_SEARCH_URL = 'https://api.hibob.com/v1/people/search';

// Local shape mirrors HiBobStubPerson minus the `team` + `isActive`
// flags this function does not consume. Keeping a typed alias makes
// the upsert payload below readable.
type HiBobPerson = Omit<HiBobStubPerson, 'team' | 'isActive'>;

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

  const config = {
    serviceUserId: Deno.env.get('HIBOB_SERVICE_USER_ID'),
    serviceUserToken: Deno.env.get('HIBOB_SERVICE_USER_TOKEN'),
    tshirtFieldId: Deno.env.get('HIBOB_TSHIRT_FIELD_ID'),
    shoeFieldId: Deno.env.get('HIBOB_SHOE_FIELD_ID'),
  };

  let person: HiBobPerson | null;
  try {
    person = await fetchHiBob(callerEmail, config);
  } catch (err) {
    return jsonResponse({ error: 'hibob_fetch_failed', detail: String(err) }, { status: 502 });
  }
  if (!person) {
    return jsonResponse({ found: false });
  }

  // Upsert with the admin client so we bypass per-column locking RLS:
  // the user can hydrate their own row even if it does not yet exist.
  const admin = getAdminClient();

  // Mark these fields as hibob-sourced if they aren't already user_entered.
  // We update the synced_at marker every time so dashboards know the cache
  // is fresh even when no values changed.
  const profileUpsert = {
    user_id: callerId,
    preferred_name: person.preferredName,
    first_name: person.firstName,
    last_name: person.lastName,
    legal_name: person.legalName,
    legal_name_source: 'hibob' as const,
    department: person.department,
    job_title: person.jobTitle,
    start_date: person.startDate,
    home_country: person.homeCountry,
    base_city: person.baseCity,
    phone_number: person.phone,
    avatar_url: person.avatarUrl,
    hibob_synced_at: new Date().toISOString(),
  };

  const { error: profileError } = await admin
    .from('employee_profiles')
    .upsert(profileUpsert, { onConflict: 'user_id' });
  if (profileError) {
    return jsonResponse(
      { error: 'profile_upsert_failed', detail: profileError.message },
      { status: 500 },
    );
  }

  // hibob_id lives on public.users; sync it across so reconciliation
  // future runs can match employees back to the HiBob row.
  await admin.from('users').update({ hibob_id: person.hibobId }).eq('id', callerId);

  if (person.tshirtSize !== null || person.shoeSizeEu !== null) {
    const swagPayload: Record<string, unknown> = { user_id: callerId };
    if (person.tshirtSize !== null) swagPayload.tshirt_size = person.tshirtSize;
    if (person.shoeSizeEu !== null) swagPayload.shoe_size_eu = person.shoeSizeEu;
    await admin.from('swag_sizes').upsert(swagPayload, { onConflict: 'user_id' });
  }

  return jsonResponse({ found: true, person });
});

async function fetchHiBob(
  email: string,
  config: {
    serviceUserId: string | undefined;
    serviceUserToken: string | undefined;
    tshirtFieldId: string | undefined;
    shoeFieldId: string | undefined;
  },
): Promise<HiBobPerson | null> {
  if (!config.serviceUserId || !config.serviceUserToken) {
    console.warn(
      '[hibob-self] HIBOB_SERVICE_USER_ID / HIBOB_SERVICE_USER_TOKEN missing — using stub directory.',
    );
    const stub = HIBOB_STUB_BY_EMAIL.get(email.toLowerCase());
    if (!stub) return null;
    // Strip team/isActive — they're not in the local HiBobPerson shape.
    const { team: _team, isActive: _isActive, ...rest } = stub;
    return rest;
  }

  const fields: string[] = [
    'root.id',
    'root.email',
    'root.firstName',
    'root.surname',
    'root.displayName',
    'root.fullName',
    'root.avatarUrl',
    'work.title',
    'work.department',
    'work.site',
    'work.startDate',
    'home.privateEmail',
    'home.mobilePhone',
    'address.country',
    'address.city',
    'internal.lifecycleStatus',
    'internal.status',
  ];
  if (config.tshirtFieldId) fields.push(`work.custom.${config.tshirtFieldId}`);
  if (config.shoeFieldId) fields.push(`work.custom.${config.shoeFieldId}`);

  const auth = btoa(`${config.serviceUserId}:${config.serviceUserToken}`);
  const response = await fetch(HIBOB_SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields,
      filters: [{ fieldPath: 'root.email', operator: 'equals', values: [email] }],
      humanReadable: 'APPEND',
    }),
  });
  if (!response.ok) throw new Error(`hibob ${response.status}`);
  const body = (await response.json()) as { employees?: any[] };
  const head = body.employees?.[0];
  if (!head) return null;

  const tshirtRaw = config.tshirtFieldId ? head.work?.custom?.[config.tshirtFieldId] : null;
  const tshirtHuman = config.tshirtFieldId
    ? head.humanReadable?.work?.custom?.[config.tshirtFieldId]
    : null;
  const shoeRaw = config.shoeFieldId ? head.work?.custom?.[config.shoeFieldId] : null;

  return {
    hibobId: head.id ?? '',
    workEmail: head.email ?? email,
    privateEmail: head.home?.privateEmail ?? null,
    legalName:
      head.fullName ?? head.displayName ?? `${head.firstName ?? ''} ${head.surname ?? ''}`.trim(),
    preferredName: head.displayName ?? null,
    firstName: head.firstName ?? null,
    lastName: head.surname ?? null,
    department: head.work?.department ?? null,
    jobTitle: head.work?.title ?? null,
    startDate: head.work?.startDate ?? null,
    homeCountry: head.address?.country ?? null,
    baseCity: head.address?.city ?? head.work?.site ?? null,
    phone: head.home?.mobilePhone ?? null,
    avatarUrl: head.avatarUrl ?? null,
    tshirtSize: tshirtHuman ?? (typeof tshirtRaw === 'string' ? tshirtRaw : null),
    shoeSizeEu: typeof shoeRaw === 'number' ? shoeRaw : null,
  };
}

// (Stub directory consolidated to supabase/functions/_shared/hibobStub.ts.)
