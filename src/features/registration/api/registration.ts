import type { AppSupabaseClient } from '@/lib/supabase';

import type { RegistrationBundle, RegistrationTaskKey } from '../types';

interface ScopedArgs {
  userId: string;
  eventId: string;
}

const DEFAULT_TASK_KEYS: RegistrationTaskKey[] = [
  'attending',
  'personal_info',
  'passport',
  'emergency_contact',
  'dietary',
  'accessibility',
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
