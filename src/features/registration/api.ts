import type { AppSupabaseClient } from '@/lib/supabase';

import type {
  DietaryRow,
  EmergencyContactRow,
  EmployeeProfileRow,
  RegistrationBundle,
  RegistrationTaskKey,
} from './types';

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
