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
//   5. Upserts emergency_contacts when HiBob has a primary contact
//      AND the user has not already filled one in (we never overwrite
//      a user-entered emergency contact).
//   6. Returns the hydrated shape so the SPA can route to the
//      registration wizard with the form pre-filled.
//
// Swag is event-scoped now (per-item catalogue under swag_items /
// swag_selections), so the old "default tshirt/shoe size from HiBob"
// path is gone. Attendees pick sizes per-item in the wizard instead.
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
import {
  HIBOB_CUSTOM_FIELDS,
  HIBOB_PATHS,
  buildHibobFieldList,
} from '../_shared/hibobFieldIds.ts';
import { HIBOB_STUB_BY_EMAIL, type HiBobStubPerson } from '../_shared/hibobStub.ts';
import { getAdminClient, getCallerUser, getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: { env: { get: (k: string) => string | undefined } };

const HIBOB_SEARCH_URL = 'https://api.hibob.com/v1/people/search';

// Local shape mirrors HiBobStubPerson minus the org-level flags this
// function does not consume (team/isActive). Keeping a typed alias
// makes the upsert payload below readable.
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

  // Upsert profile fields. Note: job_title, team, start_date, and
  // pronouns are intentionally NOT user-editable in Kizuna (the UI
  // renders them as read-only HiBob-sourced fields), so overwriting
  // them on every sign-in is the correct behaviour. preferred_name,
  // first_name, last_name, alternate_email, base_city are user-
  // editable; we still overwrite from HiBob here because the user has
  // not yet had a chance to edit during a fresh hydrate. Once they
  // edit, the legal_name_locked / future per-field locks should be
  // honoured — for now Phase 1 accepts that the next hydrate may
  // overwrite a same-day user edit, which is rare.
  const profileUpsert = {
    user_id: callerId,
    preferred_name: person.preferredName,
    first_name: person.firstName,
    last_name: person.lastName,
    legal_name: person.legalName,
    legal_name_source: 'hibob' as const,
    department: person.department,
    job_title: person.jobTitle,
    team: person.team,
    start_date: person.startDate,
    home_country: person.homeCountry,
    base_city: person.baseCity,
    pronouns: person.pronouns,
    alternate_email: person.privateEmail,
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

  // Emergency contact: only set when HiBob has one AND the user has
  // not already saved their own. We never overwrite a user-entered
  // emergency contact because the kizuna form gathers more nuance
  // (notes, phone_secondary) than HiBob does.
  if (person.emergencyContact) {
    const { data: existing } = await admin
      .from('emergency_contacts')
      .select('user_id')
      .eq('user_id', callerId)
      .maybeSingle();

    if (!existing) {
      const ec = person.emergencyContact;
      const fullName = [ec.firstName, ec.lastName].filter(Boolean).join(' ').trim();
      if (fullName && ec.relationship && ec.phone) {
        await admin.from('emergency_contacts').insert({
          user_id: callerId,
          full_name: fullName,
          relationship: ec.relationship,
          phone_primary: ec.phone,
          email: ec.email ?? null,
        });
      }
    }
  }

  return jsonResponse({ found: true, person });
});

async function fetchHiBob(
  email: string,
  config: {
    serviceUserId: string | undefined;
    serviceUserToken: string | undefined;
  },
): Promise<HiBobPerson | null> {
  if (!config.serviceUserId || !config.serviceUserToken) {
    console.warn(
      '[hibob-self] HIBOB_SERVICE_USER_ID / HIBOB_SERVICE_USER_TOKEN missing — using stub directory.',
    );
    const stub = HIBOB_STUB_BY_EMAIL.get(email.toLowerCase());
    if (!stub) return null;
    // Strip team/isActive — they're not in the local HiBobPerson shape.
    // Wait — `team` IS on HiBobPerson because we expanded it. Drop only
    // isActive (per-user hydrate ignores activation).
    const { isActive: _isActive, ...rest } = stub;
    return rest;
  }

  const auth = btoa(`${config.serviceUserId}:${config.serviceUserToken}`);
  const response = await fetch(HIBOB_SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields: buildHibobFieldList(),
      filters: [{ fieldPath: HIBOB_PATHS.email, operator: 'equals', values: [email] }],
      humanReadable: 'APPEND',
    }),
  });
  if (!response.ok) throw new Error(`hibob ${response.status}`);
  // Shape we read at the JSON boundary; cast once here, stay typed
  // everywhere else.
  interface RawEmployee {
    id?: string;
    email?: string;
    firstName?: string;
    surname?: string;
    displayName?: string;
    fullName?: string;
    avatarUrl?: string;
    work?: {
      title?: string;
      department?: string;
      site?: string;
      startDate?: string;
      custom?: Record<string, unknown>;
    };
    home?: {
      privateEmail?: string;
      mobilePhone?: string;
      emergencyContact?: {
        firstName?: string;
        surname?: string;
        relationship?: string;
        mobilePhone?: string;
        email?: string;
      };
    };
    address?: { country?: string; city?: string };
    humanReadable?: { work?: { custom?: Record<string, unknown> } };
  }
  const body = (await response.json()) as { employees?: RawEmployee[] };
  const head = body.employees?.[0];
  if (!head) return null;

  const tshirtRaw = head.work?.custom?.[HIBOB_CUSTOM_FIELDS.tshirtSize];
  const tshirtHuman = head.humanReadable?.work?.custom?.[HIBOB_CUSTOM_FIELDS.tshirtSize];
  const shoeRaw = head.work?.custom?.[HIBOB_CUSTOM_FIELDS.shoeSize];
  const teamRaw = head.work?.custom?.[HIBOB_CUSTOM_FIELDS.team];
  const teamHuman = head.humanReadable?.work?.custom?.[HIBOB_CUSTOM_FIELDS.team];
  const pronounsRaw = head.work?.custom?.[HIBOB_CUSTOM_FIELDS.pronouns];
  const pronounsHuman = head.humanReadable?.work?.custom?.[HIBOB_CUSTOM_FIELDS.pronouns];
  const ec = head.home?.emergencyContact;

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
    team: typeof teamHuman === 'string' ? teamHuman : typeof teamRaw === 'string' ? teamRaw : null,
    jobTitle: head.work?.title ?? null,
    startDate: head.work?.startDate ?? null,
    homeCountry: head.address?.country ?? null,
    baseCity: head.address?.city ?? head.work?.site ?? null,
    pronouns:
      typeof pronounsHuman === 'string'
        ? pronounsHuman
        : typeof pronounsRaw === 'string'
          ? pronounsRaw
          : null,
    phone: head.home?.mobilePhone ?? null,
    avatarUrl: head.avatarUrl ?? null,
    tshirtSize: typeof tshirtHuman === 'string' ? tshirtHuman : typeof tshirtRaw === 'string' ? tshirtRaw : null,
    shoeSizeEu: typeof shoeRaw === 'number' ? shoeRaw : null,
    emergencyContact:
      ec && (ec.firstName || ec.surname)
        ? {
            firstName: ec.firstName ?? null,
            lastName: ec.surname ?? null,
            relationship: ec.relationship ?? null,
            phone: ec.mobilePhone ?? null,
            email: ec.email ?? null,
          }
        : null,
  };
}
