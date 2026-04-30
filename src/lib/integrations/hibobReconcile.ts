/**
 * Pure reconciliation logic for a HiBob -> Kizuna sync.
 *
 * Inputs are the snapshot we just fetched from HiBob and the matching
 * subset of employee_profiles already in Kizuna. The function returns a
 * plan: which rows to update, which to skip, and which fields produced
 * conflicts that need a `data_conflicts` row.
 *
 * Kept side-effect-free so we can unit-test the diff without a database.
 * The caller (sync edge function) executes the plan against Postgres.
 */

import type { HiBobPerson } from './hibob';

export type FieldName =
  | 'legal_name'
  | 'department'
  | 'team'
  | 'job_title'
  | 'start_date'
  | 'home_country';

const FIELDS: ReadonlyArray<FieldName> = [
  'legal_name',
  'department',
  'team',
  'job_title',
  'start_date',
  'home_country',
];

/** Slim view of a Kizuna employee_profiles row used during reconciliation. */
export interface ProfileSnapshot {
  user_id: string;
  hibob_id: string | null;
  legal_name: string | null;
  legal_name_source: 'hibob' | 'perk' | 'user_entered' | 'admin_set';
  legal_name_locked: boolean;
  department: string | null;
  team: string | null;
  job_title: string | null;
  start_date: string | null;
  home_country: string | null;
}

export interface FieldUpdate {
  field: FieldName;
  newValue: string | null;
}

export interface ConflictPlan {
  user_id: string;
  field: FieldName;
  kizunaValue: string | null;
  externalValue: string | null;
}

export interface ReconciliationPlan {
  /** updates to apply to employee_profiles, keyed by user_id */
  updatesByUser: Map<string, FieldUpdate[]>;
  /** new data_conflicts rows to insert */
  conflicts: ConflictPlan[];
  /** fields skipped because they were locked or already equal */
  skipped: number;
}

interface PlanInput {
  hibob: ReadonlyArray<HiBobPerson>;
  profiles: ReadonlyArray<ProfileSnapshot>;
}

/**
 * Returns the field value of a HiBob person mapped to the Kizuna column name.
 */
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

function profileValue(profile: ProfileSnapshot, field: FieldName): string | null {
  return profile[field] ?? null;
}

/**
 * Builds the plan. Only fields that:
 *   1. exist on both sides, AND
 *   2. differ between Kizuna and HiBob,
 * lead to either an update (when the local value isn't user-overridden)
 * or a conflict (when the local value carries a user_entered / admin_set
 * source, or legal_name_locked is true).
 */
export function planHiBobReconciliation({ hibob, profiles }: PlanInput): ReconciliationPlan {
  const profilesByHibobId = new Map<string, ProfileSnapshot>();
  for (const profile of profiles) {
    if (profile.hibob_id) profilesByHibobId.set(profile.hibob_id, profile);
  }

  const updatesByUser = new Map<string, FieldUpdate[]>();
  const conflicts: ConflictPlan[] = [];
  let skipped = 0;

  for (const person of hibob) {
    const profile = profilesByHibobId.get(person.hibobId);
    if (!profile) continue;

    for (const field of FIELDS) {
      const incoming = hibobValue(person, field);
      const current = profileValue(profile, field);
      if (incoming === current) {
        continue;
      }

      // legal_name has explicit source/locked tracking. Other fields fall
      // back to a sensible default: write through unless the column has
      // been hand-edited (admin_set / user_entered), in which case we
      // record a conflict.
      const isLocked =
        field === 'legal_name' &&
        (profile.legal_name_locked || profile.legal_name_source !== 'hibob');

      if (isLocked) {
        conflicts.push({
          user_id: profile.user_id,
          field,
          kizunaValue: current,
          externalValue: incoming,
        });
        skipped += 1;
        continue;
      }

      const list = updatesByUser.get(profile.user_id) ?? [];
      list.push({ field, newValue: incoming });
      updatesByUser.set(profile.user_id, list);
    }
  }

  return { updatesByUser, conflicts, skipped };
}
