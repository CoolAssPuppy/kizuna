import type { AppSupabaseClient } from '@/lib/supabase';

export interface EmployeeIdentity {
  user_id: string;
  department: string | null;
  team: string | null;
  job_title: string | null;
  start_date: string | null;
  base_city: string | null;
  years_attended: number;
  /** Reserved for the manager → reportee chain. Always null today. */
  manager: { user_id: string; first_name: string | null; last_name: string | null } | null;
}

/**
 * One-shot loader for the structured employee fields rendered on the
 * person screen. Returns null for guests and dependents — those roles
 * have no employee_profiles row by design.
 */
export async function loadEmployeeIdentity(
  client: AppSupabaseClient,
  userId: string,
): Promise<EmployeeIdentity | null> {
  const { data, error } = await client
    .from('employee_profiles')
    .select('user_id, department, team, job_title, start_date, base_city, years_attended')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    user_id: data.user_id,
    department: data.department,
    team: data.team,
    job_title: data.job_title,
    start_date: data.start_date,
    base_city: data.base_city,
    years_attended: data.years_attended,
    manager: null,
  };
}
