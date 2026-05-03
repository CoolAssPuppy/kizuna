// HiBob custom-field IDs and field paths for the Supabase tenant.
//
// HiBob's `POST /v1/people/search` returns a structured employee object
// with both built-in paths (e.g. `root.firstName`, `work.title`) and a
// `work.custom.<field-id>` map for company-specific fields. The field
// IDs vary per tenant but are stable once minted, so we keep them here
// instead of cluttering Doppler.
//
// To update for a new tenant: open HiBob → Company settings → People
// fields, click each custom field, and copy the field ID from the URL
// (looks like `field_<uuid>` or a numeric id). The standard fields
// (firstName, surname, displayName, work.title, etc.) are HiBob built-
// ins and don't need IDs.
//
// Local stub mode (HIBOB_SERVICE_USER_ID / TOKEN absent) ignores these
// values and reads from `_shared/hibobStub.ts` instead.

/** Custom-field IDs in HiBob's `work.custom.<id>` map. */
export const HIBOB_CUSTOM_FIELDS = {
  /** "T-shirt size" custom field. Used by sync-hibob (admin) and hibob-self (per-user). */
  tshirtSize: 'tshirt_size',
  /** "Shoe size (EU)" custom field. */
  shoeSize: 'shoe_size_eu',
  /** "Team" custom field — HiBob's built-in `work.department` is the
   *  org tree; "Team" is a finer-grained label our HRBPs maintain. */
  team: 'team',
  /** "Pronouns" custom field. Read-only in Kizuna (synced from HiBob). */
  pronouns: 'pronouns',
} as const;

/** Built-in HiBob paths we read from. Kept in one place so the field-
 *  fetch list and the response parser cannot drift. */
export const HIBOB_PATHS = {
  id: 'root.id',
  email: 'root.email',
  firstName: 'root.firstName',
  surname: 'root.surname',
  displayName: 'root.displayName',
  fullName: 'root.fullName',
  avatarUrl: 'root.avatarUrl',
  jobTitle: 'work.title',
  department: 'work.department',
  site: 'work.site',
  startDate: 'work.startDate',
  privateEmail: 'home.privateEmail',
  mobilePhone: 'home.mobilePhone',
  country: 'address.country',
  city: 'address.city',
  // Emergency contact paths — HiBob exposes a single primary contact at
  // `home.emergencyContact`. Some tenants store multiple in a custom
  // section; this integration only consumes the first.
  emergencyFirstName: 'home.emergencyContact.firstName',
  emergencyLastName: 'home.emergencyContact.surname',
  emergencyRelationship: 'home.emergencyContact.relationship',
  emergencyPhone: 'home.emergencyContact.mobilePhone',
  emergencyEmail: 'home.emergencyContact.email',
} as const;

/**
 * The full list of paths to request from `/v1/people/search`. This is
 * the union of HIBOB_PATHS values plus every `work.custom.<id>` we
 * care about, so the request body and the parser stay in lockstep.
 */
export function buildHibobFieldList(): string[] {
  const builtins = Object.values(HIBOB_PATHS);
  const customs = Object.values(HIBOB_CUSTOM_FIELDS).map((id) => `work.custom.${id}`);
  return [...builtins, ...customs];
}
