import type { AppSupabaseClient } from '@/lib/supabase';

import type {
  ChildRow,
  DietaryRow,
  EmergencyContactRow,
  EmployeeProfileRow,
  RegistrationBundle,
  RegistrationTaskKey,
} from './types';
import type { Database } from '@/types/database.types';

type PassportRow = Database['public']['Tables']['passport_details']['Row'];
type SwagItemRow = Database['public']['Tables']['swag_items']['Row'];
type SwagSelectionRow = Database['public']['Tables']['swag_selections']['Row'];

interface ScopedArgs {
  userId: string;
  eventId: string;
}

const DEFAULT_TASK_KEYS: RegistrationTaskKey[] = [
  'personal_info',
  'passport',
  'emergency_contact',
  'dietary',
  'swag',
  'transport',
  'documents',
];

/**
 * Returns the registration row for a user/event, creating it (with the
 * default per-event task list) if it does not yet exist.
 *
 * `completion_pct` is maintained by a Postgres trigger; never write it
 * from app code.
 */
export async function ensureRegistration(
  client: AppSupabaseClient,
  { userId, eventId }: ScopedArgs,
): Promise<RegistrationBundle> {
  const existing = await client
    .from('registrations')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  let registration = existing.data;

  if (!registration) {
    const { data, error } = await client
      .from('registrations')
      .insert({ user_id: userId, event_id: eventId, status: 'started' })
      .select()
      .single();
    if (error) throw error;
    registration = data;

    const taskRows = DEFAULT_TASK_KEYS.map((task_key) => ({
      registration_id: registration!.id,
      task_key,
      applies_to: 'all' as const,
    }));
    const { error: tasksError } = await client.from('registration_tasks').insert(taskRows);
    if (tasksError) throw tasksError;
  }

  const tasks = await client
    .from('registration_tasks')
    .select('*')
    .eq('registration_id', registration.id)
    .order('task_key', { ascending: true });

  if (tasks.error) throw tasks.error;

  return { registration, tasks: tasks.data ?? [] };
}

export async function markTaskComplete(
  client: AppSupabaseClient,
  registrationId: string,
  taskKey: RegistrationTaskKey,
): Promise<void> {
  const { error } = await client
    .from('registration_tasks')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('registration_id', registrationId)
    .eq('task_key', taskKey);
  if (error) throw error;
}

/** Personal info step — upserts employee_profiles. */
export async function savePersonalInfo(
  client: AppSupabaseClient,
  userId: string,
  values: Pick<EmployeeProfileRow, 'preferred_name' | 'legal_name' | 'base_city'>,
): Promise<void> {
  const { error } = await client.from('employee_profiles').upsert(
    {
      user_id: userId,
      preferred_name: values.preferred_name,
      legal_name: values.legal_name,
      base_city: values.base_city,
      legal_name_source: 'user_entered',
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadPersonalInfo(
  client: AppSupabaseClient,
  userId: string,
): Promise<EmployeeProfileRow | null> {
  const { data, error } = await client
    .from('employee_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Dietary step. */
export async function saveDietary(
  client: AppSupabaseClient,
  userId: string,
  values: Pick<DietaryRow, 'restrictions' | 'allergies' | 'alcohol_free' | 'severity' | 'notes'>,
): Promise<void> {
  const { error } = await client.from('dietary_preferences').upsert(
    {
      user_id: userId,
      restrictions: values.restrictions,
      allergies: values.allergies,
      alcohol_free: values.alcohol_free,
      severity: values.severity,
      notes: values.notes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadDietary(
  client: AppSupabaseClient,
  userId: string,
): Promise<DietaryRow | null> {
  const { data, error } = await client
    .from('dietary_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Emergency contact step. */
export async function saveEmergencyContact(
  client: AppSupabaseClient,
  userId: string,
  values: Pick<
    EmergencyContactRow,
    'full_name' | 'relationship' | 'phone_primary' | 'phone_secondary' | 'email' | 'notes'
  >,
): Promise<void> {
  const { error } = await client.from('emergency_contacts').upsert(
    {
      user_id: userId,
      full_name: values.full_name,
      relationship: values.relationship,
      phone_primary: values.phone_primary,
      phone_secondary: values.phone_secondary,
      email: values.email,
      notes: values.notes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function loadEmergencyContact(
  client: AppSupabaseClient,
  userId: string,
): Promise<EmergencyContactRow | null> {
  const { data, error } = await client
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Passport step.
 *
 * Calls the security-definer RPC set_passport so the passport number is
 * encrypted at rest with pgcrypto. The plaintext number never lands in a
 * client-readable column.
 */
export async function savePassport(
  client: AppSupabaseClient,
  userId: string,
  values: {
    passportName: string;
    passportNumber: string;
    issuingCountry: string;
    expiryDate: string;
  },
): Promise<void> {
  // Note: kizuna.passport_key is set via Postgres GUC in production. The local
  // dev DB needs ALTER DATABASE postgres SET kizuna.passport_key='dev-key'.
  const { error } = await client.rpc('set_passport', {
    p_user_id: userId,
    p_passport_name: values.passportName,
    p_passport_number: values.passportNumber,
    p_issuing_country: values.issuingCountry,
    p_expiry_date: values.expiryDate,
  });
  if (error) throw error;
}

/** Loads non-secret passport metadata. The number is never returned. */
export async function loadPassportMetadata(
  client: AppSupabaseClient,
  userId: string,
): Promise<Pick<PassportRow, 'passport_name' | 'issuing_country' | 'expiry_date'> | null> {
  const { data, error } = await client
    .from('passport_details')
    .select('passport_name, issuing_country, expiry_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Children step — replaces the user's children list with the provided rows. */
interface ChildInput {
  id?: string;
  full_name: string;
  date_of_birth: string;
  special_needs: string[];
  notes: string | null;
}

export async function loadChildren(client: AppSupabaseClient, userId: string): Promise<ChildRow[]> {
  const { data, error } = await client
    .from('children')
    .select('*')
    .eq('sponsor_id', userId)
    .order('date_of_birth', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveChildren(
  client: AppSupabaseClient,
  userId: string,
  rows: ChildInput[],
): Promise<void> {
  // Replace strategy: delete missing rows, upsert provided rows. Avoids
  // diff-management complexity in the UI for what is rarely more than a
  // handful of records.
  const existing = await loadChildren(client, userId);
  const keepIds = rows.map((r) => r.id).filter((id): id is string => Boolean(id));
  const toDelete = existing.filter((row) => !keepIds.includes(row.id));

  if (toDelete.length > 0) {
    const { error } = await client
      .from('children')
      .delete()
      .in(
        'id',
        toDelete.map((r) => r.id),
      );
    if (error) throw error;
  }

  if (rows.length > 0) {
    const upsertRows = rows.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      sponsor_id: userId,
      full_name: row.full_name,
      date_of_birth: row.date_of_birth,
      special_needs: row.special_needs,
      notes: row.notes,
    }));
    const { error } = await client.from('children').upsert(upsertRows, { onConflict: 'id' });
    if (error) throw error;
  }
}

/** Swag step. */
export async function loadSwagCatalogue(
  client: AppSupabaseClient,
  eventId: string,
): Promise<SwagItemRow[]> {
  const { data, error } = await client
    .from('swag_items')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function loadSwagSelections(
  client: AppSupabaseClient,
  userId: string,
): Promise<SwagSelectionRow[]> {
  const { data, error } = await client.from('swag_selections').select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export interface SwagSelectionInput {
  swagItemId: string;
  optedIn: boolean;
  size: string | null;
  fitPreference: 'fitted' | 'relaxed' | null;
}

export async function saveSwagSelections(
  client: AppSupabaseClient,
  userId: string,
  selections: SwagSelectionInput[],
): Promise<void> {
  if (selections.length === 0) return;
  const rows = selections.map((s) => ({
    user_id: userId,
    swag_item_id: s.swagItemId,
    opted_in: s.optedIn,
    size: s.size,
    fit_preference: s.fitPreference,
  }));
  const { error } = await client
    .from('swag_selections')
    .upsert(rows, { onConflict: 'user_id,swag_item_id' });
  if (error) throw error;
}
