/**
 * HiBob People API wrapper.
 *
 * HiBob (`https://api.hibob.com/v1`) is the source of truth for employee
 * identity at Supabase: legal name, work email, department, manager,
 * start date, and tenant-defined custom fields like t-shirt size and
 * shoe size. Kizuna pulls a snapshot at sign-in time so the registration
 * wizard can pre-fill what's known and the attendee only edits what
 * differs from HiBob.
 *
 * # Modes
 * - **Live**: SERVICE_USER_ID + SERVICE_USER_TOKEN are set; the wrapper
 *   issues real HTTPS calls with HTTP Basic Auth.
 * - **Stubbed**: either env var is missing; the wrapper returns a
 *   deterministic fixture keyed by email and logs a single warning.
 *   Callers never throw — they always see a usable shape.
 *
 * # Why we don't fetch the directory
 * The legacy `GET /v1/people` is slow at scale and is not the
 * documented happy path. The wrapper instead uses
 * `POST /v1/people/search` with a `root.email` filter so only the
 * relevant employee is loaded.
 *
 * # Authentication (do not change without reading the docs)
 * HiBob's REST API uses HTTP Basic Auth with a Service User created in
 * `Bob > Settings > Account > Integrations > Service Users`. Each
 * service user has granular per-category View / View History / Edit
 * permissions; for Kizuna we only need View on About, Work, Personal,
 * Address, Home, and the t-shirt / shoe custom fields. Tokens are
 * tenant-scoped and can be rotated without code changes.
 *
 *   Authorization: Basic base64("SERVICE_USER_ID:SERVICE_USER_TOKEN")
 *
 * The legacy Bearer-token path (Account > API Access Tokens) is being
 * deprecated; do not use it.
 *
 * # Field paths
 * Field paths in `POST /people/search` are dotted from the employee
 * root. The full list lives at
 *   `GET /v1/company/people/fields`
 * and we strongly recommend running that once and pinning the IDs in
 * env vars (HIBOB_TSHIRT_FIELD_ID, HIBOB_SHOE_FIELD_ID) — custom field
 * IDs look like `field_1711886937296` and are tenant-specific.
 *
 * Setting `humanReadable: 'APPEND'` returns parallel `humanReadable.*`
 * keys so an enum custom field surfaces both as the raw enum value and
 * as the visible label ("Large" vs the underlying ordinal).
 *
 * # When you actually wire this up
 *
 *   1. Create a Service User in Bob with View on About, Work, Personal,
 *      Address, Home, and any custom fields you intend to read.
 *   2. Generate the token, copy SERVICE_USER_ID and SERVICE_USER_TOKEN.
 *      Store both in Doppler under HIBOB_SERVICE_USER_ID and
 *      HIBOB_SERVICE_USER_TOKEN.
 *   3. Discover the t-shirt / shoe custom-field IDs:
 *        curl -u "$HIBOB_SERVICE_USER_ID:$HIBOB_SERVICE_USER_TOKEN" \
 *             https://api.hibob.com/v1/company/people/fields
 *      Find the rows whose `name` matches your tenant's t-shirt and shoe
 *      fields. Pin their `id` values into HIBOB_TSHIRT_FIELD_ID and
 *      HIBOB_SHOE_FIELD_ID in Doppler.
 *   4. Test against a single employee:
 *        curl -u "$HIBOB_SERVICE_USER_ID:$HIBOB_SERVICE_USER_TOKEN" \
 *             -H "Content-Type: application/json" \
 *             -X POST https://api.hibob.com/v1/people/search \
 *             -d '{"fields":["root.id","root.email","root.firstName","root.surname"],
 *                  "filters":[{"fieldPath":"root.email","operator":"equals",
 *                              "values":["someone@yourdomain.com"]}],
 *                  "humanReadable":"APPEND"}'
 *   5. Once the response shape matches `RawHiBobPerson` below, flip
 *      DEV_MODE off in your env and the live path takes over.
 *
 * # Rate limits
 * Not numerically documented. Honor 429 + Retry-After. Cache results
 * per session — the registration wizard only needs one fetch per
 * sign-in.
 *
 * # Webhooks (future)
 * HiBob exposes employee.created / employee.updated /
 * employee.terminated webhooks signed with HMAC-SHA512 in the
 * `Bob-Signature` header. We don't subscribe today; when we do, the
 * verification helper belongs in supabase/functions/hibob-webhook.
 */

import type { IntegrationStatus } from './types';

/** Subset of HiBob fields Kizuna actually consumes. */
export interface HiBobPerson {
  hibobId: string;
  workEmail: string;
  privateEmail: string | null;
  legalName: string;
  preferredName: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  /**
   * Sub-org / pod. HiBob exposes this only via a tenant-specific custom
   * field, so the live wrapper leaves it null until HIBOB_TEAM_FIELD_ID
   * is wired up. Stub data sets a value so reconciliation tests can
   * still cover the diffing behaviour.
   */
  team: string | null;
  jobTitle: string | null;
  managerHibobId: string | null;
  startDate: string | null;
  homeCountry: string | null;
  baseCity: string | null;
  phone: string | null;
  avatarUrl: string | null;
  tshirtSize: string | null;
  shoeSizeEu: number | null;
  isActive: boolean;
}

interface DriverConfig {
  /** Service User id — first half of HTTP Basic credential. */
  serviceUserId?: string | undefined;
  /** Service User token — second half. */
  serviceUserToken?: string | undefined;
  /** Tenant-pinned custom field id for the t-shirt size (e.g. field_…). */
  tshirtFieldId?: string | undefined;
  /** Tenant-pinned custom field id for the shoe size. */
  shoeFieldId?: string | undefined;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
}

const HIBOB_BASE = 'https://api.hibob.com/v1';

export function hibobStatus(config: DriverConfig): IntegrationStatus {
  const live = !!config.serviceUserId && !!config.serviceUserToken;
  return live
    ? { mode: 'live' }
    : { mode: 'stubbed', reason: 'HIBOB_SERVICE_USER_ID / TOKEN missing' };
}

let stubWarned = false;

/**
 * Fetch one HiBob employee by work email. Used by the SSO hydration
 * flow: the Okta callback returns an email, we look up the employee,
 * we seed users / employee_profiles / swag_sizes from the result.
 */
export async function fetchHiBobByEmail(
  config: DriverConfig,
  email: string,
): Promise<HiBobPerson | null> {
  if (hibobStatus(config).mode === 'stubbed') {
    if (!stubWarned) {
      stubWarned = true;
      console.warn(
        '[kizuna] HiBob credentials missing — returning stub. Set HIBOB_SERVICE_USER_ID and HIBOB_SERVICE_USER_TOKEN to enable live lookups.',
      );
    }
    return STUB_BY_EMAIL.get(email.toLowerCase()) ?? null;
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  // List of field paths the response should include. Custom fields are
  // appended dynamically because their ids are tenant-specific.
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
    'work.reportsTo',
    'home.privateEmail',
    'home.mobilePhone',
    'address.country',
    'address.city',
    'internal.lifecycleStatus',
    'internal.status',
  ];
  if (config.tshirtFieldId) fields.push(`work.custom.${config.tshirtFieldId}`);
  if (config.shoeFieldId) fields.push(`work.custom.${config.shoeFieldId}`);

  const auth = btoaSafe(`${config.serviceUserId}:${config.serviceUserToken}`);
  const response = await fetchImpl(`${HIBOB_BASE}/people/search`, {
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
  if (!response.ok) {
    throw new Error(`HiBob /people/search failed (${response.status})`);
  }
  const body = (await response.json()) as { employees?: ReadonlyArray<unknown> };
  const head = body.employees?.[0];
  if (!head) return null;
  return normaliseHiBobPerson(head, config);
}

/** Server / Deno safe `btoa`. */
function btoaSafe(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  // Deno + Node both have global Buffer when this is loaded server-side.
  // The `as { Buffer? : ... }` keeps the browser bundle from missing the
  // type at compile time even though Buffer is unreachable there.
  const g = globalThis as {
    Buffer?: { from: (s: string) => { toString: (enc: string) => string } };
  };
  if (g.Buffer) return g.Buffer.from(input).toString('base64');
  throw new Error('No base64 encoder available in this runtime');
}

/**
 * Documented shape of a single employee as returned by
 * `POST /people/search`. Kept as a discriminator-free interface because
 * HiBob trims missing fields silently — every property is optional.
 */
interface RawHiBobPerson {
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
    reportsTo?: { id?: string };
    custom?: Record<string, unknown>;
  };
  home?: {
    privateEmail?: string;
    mobilePhone?: string;
  };
  address?: {
    country?: string;
    city?: string;
  };
  personal?: { legalName?: string };
  internal?: {
    lifecycleStatus?: string;
    status?: string;
  };
  // humanReadable mirrors the same tree but with human labels for enums
  // and references; we read it for t-shirt size which is usually an enum.
  humanReadable?: {
    work?: { custom?: Record<string, string | undefined> };
  };
}

function normaliseHiBobPerson(raw: unknown, config: DriverConfig): HiBobPerson {
  const r = raw as RawHiBobPerson;
  const tshirtRaw = config.tshirtFieldId ? r.work?.custom?.[config.tshirtFieldId] : null;
  const shoeRaw = config.shoeFieldId ? r.work?.custom?.[config.shoeFieldId] : null;
  // T-shirt is usually an enum custom field; humanReadable carries the
  // visible label ('Large') vs the raw ordinal. Prefer the label.
  const tshirtHuman = config.tshirtFieldId
    ? r.humanReadable?.work?.custom?.[config.tshirtFieldId]
    : null;
  const tshirtSize = tshirtHuman ?? (typeof tshirtRaw === 'string' ? tshirtRaw : null);

  const shoeNumeric =
    typeof shoeRaw === 'number'
      ? shoeRaw
      : typeof shoeRaw === 'string' && !Number.isNaN(Number(shoeRaw))
        ? Number(shoeRaw)
        : null;

  return {
    hibobId: r.id ?? '',
    workEmail: r.email ?? '',
    privateEmail: r.home?.privateEmail ?? null,
    legalName: r.fullName ?? r.displayName ?? joinName(r.firstName, r.surname),
    preferredName: r.displayName ?? null,
    firstName: r.firstName ?? null,
    lastName: r.surname ?? null,
    department: r.work?.department ?? null,
    team: null, // Modern HiBob exposes 'team' only via tenant custom fields.
    jobTitle: r.work?.title ?? null,
    managerHibobId: r.work?.reportsTo?.id ?? null,
    startDate: r.work?.startDate ?? null,
    homeCountry: r.address?.country ?? null,
    baseCity: r.address?.city ?? r.work?.site ?? null,
    phone: r.home?.mobilePhone ?? null,
    avatarUrl: r.avatarUrl ?? null,
    tshirtSize,
    shoeSizeEu: shoeNumeric,
    isActive: r.internal?.status === 'active' || r.internal?.lifecycleStatus === 'Employed',
  };
}

function joinName(first?: string, last?: string): string {
  return [first, last].filter(Boolean).join(' ');
}

/**
 * Stub directory keyed by lowercase work email. Mirrors the seed
 * employees so local sign-in flows have data even without a HiBob
 * tenant. New stub rows belong here whenever a new sample employee is
 * added to supabase/fixtures/01_sample_employees.sql.
 */
const STUB_BY_EMAIL: ReadonlyMap<string, HiBobPerson> = new Map([
  [
    'paul@kizuna.dev',
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
      managerHibobId: null,
      startDate: '2023-06-01',
      homeCountry: 'GB',
      baseCity: 'London',
      phone: '+44 20 7946 0123',
      avatarUrl: null,
      tshirtSize: 'L',
      shoeSizeEu: 44,
      isActive: true,
    },
  ],
  [
    'maya@kizuna.dev',
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
      managerHibobId: null,
      startDate: '2024-09-15',
      homeCountry: 'US',
      baseCity: 'New York',
      phone: null,
      avatarUrl: null,
      tshirtSize: 'M',
      shoeSizeEu: 39,
      isActive: true,
    },
  ],
  [
    'lu@kizuna.dev',
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
      managerHibobId: null,
      startDate: '2022-03-01',
      homeCountry: 'CA',
      baseCity: 'Toronto',
      phone: '+1 416 555 0123',
      avatarUrl: null,
      tshirtSize: 'S',
      shoeSizeEu: 38,
      isActive: true,
    },
  ],
]);

export const __TEST = { STUB_BY_EMAIL, normaliseHiBobPerson };
