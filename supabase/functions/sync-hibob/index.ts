// Edge function: sync-hibob
//
// Admin-triggered. Pulls the HiBob directory, diffs against the current
// employee_profiles, applies non-conflicting updates, and writes one
// data_conflicts row per locked-or-overridden field.
//
// Audit trail lives in hibob_sync_log: each invocation records start,
// completion, status, counts, and (on failure) error_detail.

import { requireAdmin } from '../_shared/adminGuard.ts';
import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

// HiBob's documented happy-path is `POST /v1/people/search` with HTTP
// Basic auth using a Service User credential. The legacy
// `GET /v1/people` endpoint with a Bearer token is being deprecated; do
// not move back to it.
const HIBOB_SEARCH_URL = 'https://api.hibob.com/v1/people/search';

interface HiBobPerson {
  id: string;
  email: string;
  legalName: string;
  preferredName: string | null;
  department: string | null;
  team: string | null;
  jobTitle: string | null;
  startDate: string | null;
  homeCountry: string | null;
}

interface ProfileRow {
  user_id: string;
  hibob_id: string | null;
  legal_name: string | null;
  legal_name_source: string;
  legal_name_locked: boolean;
  department: string | null;
  team: string | null;
  job_title: string | null;
  start_date: string | null;
  home_country: string | null;
}

const FIELDS = [
  'legal_name',
  'department',
  'team',
  'job_title',
  'start_date',
  'home_country',
] as const;

type FieldName = (typeof FIELDS)[number];

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const guard = await requireAdmin(req);
  if (guard instanceof Response) return guard;

  const serviceUserId = Deno.env.get('HIBOB_SERVICE_USER_ID');
  const serviceUserToken = Deno.env.get('HIBOB_SERVICE_USER_TOKEN');
  const tshirtFieldId = Deno.env.get('HIBOB_TSHIRT_FIELD_ID');
  const teamFieldId = Deno.env.get('HIBOB_TEAM_FIELD_ID');
  const admin = getAdminClient();

  // Open the audit row so a failure in HiBob still gets recorded.
  const { data: logRow, error: logError } = await admin
    .from('hibob_sync_log')
    .insert({ status: 'success' })
    .select()
    .single();
  if (logError || !logRow) {
    return jsonResponse({ error: logError?.message ?? 'log_failed' }, { status: 500 });
  }

  let directory: HiBobPerson[];
  try {
    directory = await fetchDirectory({
      serviceUserId,
      serviceUserToken,
      tshirtFieldId,
      teamFieldId,
    });
  } catch (err: unknown) {
    await admin
      .from('hibob_sync_log')
      .update({
        sync_completed_at: new Date().toISOString(),
        status: 'failed',
        error_detail: { message: String(err) },
      })
      .eq('id', logRow.id);
    return jsonResponse({ error: 'hibob_fetch_failed' }, { status: 502 });
  }

  const { data: profiles, error: profilesError } = await admin
    .from('employee_profiles')
    .select(
      'user_id, hibob_id, legal_name, legal_name_source, legal_name_locked, department, team, job_title, start_date, home_country',
    );
  if (profilesError) {
    return jsonResponse({ error: profilesError.message }, { status: 500 });
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let conflictsCreated = 0;

  const profilesByHibobId = new Map<string, ProfileRow>();
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    if (profile.hibob_id) profilesByHibobId.set(profile.hibob_id, profile);
  }

  for (const person of directory) {
    processed += 1;
    const profile = profilesByHibobId.get(person.id);
    if (!profile) continue;

    const updatePayload: Record<string, string | null> = {};
    let didUpdate = false;

    for (const field of FIELDS) {
      const incoming = hibobValue(person, field);
      const current = profile[field as keyof ProfileRow] as string | null;
      if (incoming === current) continue;

      const isLockedField =
        field === 'legal_name' &&
        (profile.legal_name_locked || profile.legal_name_source !== 'hibob');

      if (isLockedField) {
        await admin.from('data_conflicts').insert({
          user_id: profile.user_id,
          table_name: 'employee_profiles',
          field_name: field,
          kizuna_value: current,
          external_value: incoming,
          external_source: 'hibob',
          status: 'open',
        });
        conflictsCreated += 1;
        skipped += 1;
        continue;
      }

      updatePayload[field] = incoming;
      didUpdate = true;
    }

    if (didUpdate) {
      updatePayload.hibob_synced_at = new Date().toISOString();
      await admin.from('employee_profiles').update(updatePayload).eq('user_id', profile.user_id);
      updated += 1;
    }
  }

  await admin
    .from('hibob_sync_log')
    .update({
      sync_completed_at: new Date().toISOString(),
      status: 'success',
      records_processed: processed,
      records_updated: updated,
      records_skipped: skipped,
      conflicts_created: conflictsCreated,
    })
    .eq('id', logRow.id);

  return jsonResponse({
    processed,
    updated,
    skipped,
    conflictsCreated,
    syncId: logRow.id,
  });
});

interface DirectoryConfig {
  serviceUserId: string | undefined;
  serviceUserToken: string | undefined;
  tshirtFieldId: string | undefined;
  teamFieldId: string | undefined;
}

async function fetchDirectory(config: DirectoryConfig): Promise<HiBobPerson[]> {
  if (!config.serviceUserId || !config.serviceUserToken) {
    console.warn(
      '[kizuna] HIBOB_SERVICE_USER_ID / HIBOB_SERVICE_USER_TOKEN missing — using stub directory.',
    );
    return STUB_DIRECTORY;
  }
  // Pulling the entire directory in one POST search call. Large tenants
  // should switch to paginated /people/search with cursor; for Supafest
  // the org fits comfortably under a single response.
  const fields: string[] = [
    'root.id',
    'root.email',
    'root.firstName',
    'root.surname',
    'root.displayName',
    'root.fullName',
    'work.title',
    'work.department',
    'work.startDate',
    'address.country',
    'internal.lifecycleStatus',
    'internal.status',
  ];
  if (config.teamFieldId) fields.push(`work.custom.${config.teamFieldId}`);
  if (config.tshirtFieldId) fields.push(`work.custom.${config.tshirtFieldId}`);

  const auth = btoa(`${config.serviceUserId}:${config.serviceUserToken}`);
  const response = await fetch(HIBOB_SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ fields, humanReadable: 'APPEND' }),
  });
  if (!response.ok) {
    throw new Error(`hibob ${response.status}`);
  }
  // Trust HiBob to send a stable shape; document the keys we read so
  // a regen catches drift. The boundary cast lives here, the rest of
  // the file stays strictly typed.
  interface RawEmployee {
    id?: string;
    email?: string;
    firstName?: string;
    surname?: string;
    displayName?: string;
    fullName?: string;
    work?: {
      title?: string;
      department?: string;
      startDate?: string;
      custom?: Record<string, unknown>;
    };
    address?: { country?: string };
  }
  const body = (await response.json()) as { employees?: RawEmployee[] };
  return (body.employees ?? []).map((e) => {
    const teamCustom = config.teamFieldId ? e.work?.custom?.[config.teamFieldId] : null;
    return {
      id: e.id ?? '',
      email: e.email ?? '',
      legalName: e.fullName ?? e.displayName ?? `${e.firstName ?? ''} ${e.surname ?? ''}`.trim(),
      preferredName: e.displayName ?? null,
      department: e.work?.department ?? null,
      team: typeof teamCustom === 'string' ? teamCustom : null,
      jobTitle: e.work?.title ?? null,
      startDate: e.work?.startDate ?? null,
      homeCountry: e.address?.country ?? null,
    };
  });
}

function hibobValue(row: HiBobPerson, field: FieldName): string | null {
  switch (field) {
    case 'legal_name':
      return row.legalName || null;
    case 'department':
      return row.department;
    case 'team':
      return row.team;
    case 'job_title':
      return row.jobTitle;
    case 'start_date':
      return row.startDate;
    case 'home_country':
      return row.homeCountry;
  }
}

const STUB_DIRECTORY: HiBobPerson[] = [
  {
    id: 'hibob_paul',
    email: 'paul@kizuna.dev',
    legalName: 'Paul Park',
    preferredName: 'Paul',
    department: 'Engineering',
    team: 'Database',
    jobTitle: 'Senior Engineer',
    startDate: '2023-06-01',
    homeCountry: 'GB',
  },
];
