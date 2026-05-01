// Shared HiBob stub directory.
//
// One source of truth for the deterministic fixture data the SPA
// (src/lib/integrations/hibob.ts) and the edge functions
// (sync-hibob, hibob-self) all return when no real HIBOB_SERVICE_USER_ID
// + HIBOB_SERVICE_USER_TOKEN is configured. Three earlier copies were
// drifting (different t-shirt sizes, different team labels); this
// module collapses them.
//
// Keep this file aligned with supabase/fixtures/01_sample_employees.sql
// — every email here should also exist as a seeded employee.

export interface HiBobStubPerson {
  hibobId: string;
  workEmail: string;
  privateEmail: string | null;
  legalName: string;
  preferredName: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  team: string | null;
  jobTitle: string | null;
  startDate: string | null;
  homeCountry: string | null;
  baseCity: string | null;
  phone: string | null;
  avatarUrl: string | null;
  tshirtSize: string | null;
  shoeSizeEu: number | null;
  isActive: boolean;
}

export const HIBOB_STUB: ReadonlyArray<HiBobStubPerson> = [
  {
    hibobId: 'hibob_paul',
    workEmail: 'paul@kizuna.dev',
    privateEmail: 'paul.park@gmail.com',
    legalName: 'Paul Park',
    preferredName: 'Paul',
    firstName: 'Paul',
    lastName: 'Park',
    department: 'Engineering',
    team: 'Database',
    jobTitle: 'Senior Engineer',
    startDate: '2023-06-01',
    homeCountry: 'GB',
    baseCity: 'London',
    phone: '+44 20 7946 0123',
    avatarUrl: null,
    tshirtSize: 'L',
    shoeSizeEu: 44,
    isActive: true,
  },
  {
    hibobId: 'hibob_maya',
    workEmail: 'maya@kizuna.dev',
    privateEmail: null,
    legalName: 'Maya Mason',
    preferredName: 'Maya',
    firstName: 'Maya',
    lastName: 'Mason',
    department: 'Marketing',
    team: 'Content',
    jobTitle: 'Content Lead',
    startDate: '2024-09-15',
    homeCountry: 'US',
    baseCity: 'New York',
    phone: null,
    avatarUrl: null,
    tshirtSize: 'M',
    shoeSizeEu: 39,
    isActive: true,
  },
  {
    hibobId: 'hibob_lu',
    workEmail: 'lu@kizuna.dev',
    privateEmail: null,
    legalName: 'Lu Liu',
    preferredName: 'Lu',
    firstName: 'Lu',
    lastName: 'Liu',
    department: 'Operations',
    team: 'Events',
    jobTitle: 'Events Manager',
    startDate: '2022-03-01',
    homeCountry: 'CA',
    baseCity: 'Toronto',
    phone: '+1 416 555 0123',
    avatarUrl: null,
    tshirtSize: 'S',
    shoeSizeEu: 38,
    isActive: true,
  },
];

export const HIBOB_STUB_BY_EMAIL: ReadonlyMap<string, HiBobStubPerson> = new Map(
  HIBOB_STUB.map((p) => [p.workEmail.toLowerCase(), p]),
);
