/**
 * HiBob employee directory wrapper.
 *
 * HiBob is the source of truth for employees, their org units, and core
 * personal data (legal name, department, team, job title, etc.). When a
 * user has manually overridden a synced field in Kizuna, the override
 * lands in `data_conflicts` rather than being silently overwritten.
 *
 * Live mode: HTTPS GET against https://api.hibob.com/v1/people with the
 * Bearer key.
 *
 * Stubbed mode: returns a deterministic sample directory of three rows
 * so syncs and conflict-resolution UI work end-to-end in dev without a
 * HiBob account.
 */

import type { IntegrationStatus } from './types';

export interface HiBobPerson {
  hibobId: string;
  email: string;
  legalName: string;
  preferredName: string | null;
  department: string | null;
  team: string | null;
  jobTitle: string | null;
  startDate: string | null;
  homeCountry: string | null;
  isActive: boolean;
}

interface DriverConfig {
  apiKey?: string | undefined;
  fetchImpl?: typeof fetch;
}

export function hibobStatus(config: DriverConfig): IntegrationStatus {
  return config.apiKey ? { mode: 'live' } : { mode: 'stubbed', reason: 'HIBOB_API_KEY missing' };
}

const STUB_DIRECTORY: ReadonlyArray<HiBobPerson> = [
  {
    hibobId: 'hibob_paul',
    email: 'paul@kizuna.dev',
    legalName: 'Paul Park',
    preferredName: 'Paul',
    department: 'Engineering',
    team: 'Database',
    jobTitle: 'Senior Engineer',
    startDate: '2023-06-01',
    homeCountry: 'GB',
    isActive: true,
  },
  {
    hibobId: 'hibob_maya',
    email: 'maya@kizuna.dev',
    legalName: 'Maya Mason',
    preferredName: 'Maya',
    department: 'Marketing',
    team: 'Content',
    jobTitle: 'Content Lead',
    startDate: '2024-09-15',
    homeCountry: 'US',
    isActive: true,
  },
  {
    hibobId: 'hibob_lu',
    email: 'lu@kizuna.dev',
    legalName: 'Lu Liu',
    preferredName: 'Lu',
    department: 'Operations',
    team: 'Events',
    jobTitle: 'Events Manager',
    startDate: '2022-03-01',
    homeCountry: 'CA',
    isActive: true,
  },
];

export async function fetchHiBobDirectory(config: DriverConfig): Promise<HiBobPerson[]> {
  if (hibobStatus(config).mode === 'stubbed') {
    console.warn('[kizuna] HIBOB_API_KEY missing — returning stub directory.');
    return [...STUB_DIRECTORY];
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl('https://api.hibob.com/v1/people', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey ?? ''}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HiBob /people failed (${response.status})`);
  }
  const body = (await response.json()) as { employees?: ReadonlyArray<unknown> };
  return (body.employees ?? []).map(normaliseHiBobPerson);
}

interface RawHiBobPerson {
  id?: string;
  work?: { email?: string; department?: string; team?: string; title?: string; startDate?: string };
  personal?: { displayName?: string; legalName?: string };
  home?: { countryCode?: string };
  state?: string;
}

function normaliseHiBobPerson(raw: unknown): HiBobPerson {
  const r = raw as RawHiBobPerson;
  return {
    hibobId: r.id ?? '',
    email: r.work?.email ?? '',
    legalName: r.personal?.legalName ?? r.personal?.displayName ?? '',
    preferredName: r.personal?.displayName ?? null,
    department: r.work?.department ?? null,
    team: r.work?.team ?? null,
    jobTitle: r.work?.title ?? null,
    startDate: r.work?.startDate ?? null,
    homeCountry: r.home?.countryCode ?? null,
    isActive: r.state !== 'terminated',
  };
}
