import type { AppSupabaseClient } from '@/lib/supabase';

export interface RegistrationFunnel {
  invited: number;
  started: number;
  complete: number;
  cancelled: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface AdminStats {
  funnel: RegistrationFunnel;
  attendeesByRole: CategoryCount[];
  attendeesByCountry: CategoryCount[];
  attendeesByDepartment: CategoryCount[];
  dietaryRestrictions: CategoryCount[];
  allergies: CategoryCount[];
  alcoholFreeShare: { freeOf: number; total: number };
  paymentStatus: CategoryCount[];
  yearsAttended: CategoryCount[];
  accessibilityNeeds: CategoryCount[];
}

function bumpCount(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function asEntries(map: Map<string, number>): CategoryCount[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Convert a numeric-keyed distribution (e.g. years attended) into a sorted,
 * gap-filled series so a histogram renders as a continuous distribution
 * across the x-axis instead of a sparse jagged set of bars.
 */
function asNumericDistribution(map: Map<string, number>): CategoryCount[] {
  if (map.size === 0) return [];
  const max = Math.max(...Array.from(map.keys()).map((k) => Number.parseInt(k, 10)));
  const out: CategoryCount[] = [];
  for (let i = 0; i <= max; i++) {
    out.push({ name: `${i}`, count: map.get(`${i}`) ?? 0 });
  }
  return out;
}

export async function fetchAdminStats(
  client: AppSupabaseClient,
  eventId: string,
): Promise<AdminStats> {
  const [
    registrationsRes,
    usersRes,
    employeeProfilesRes,
    dietaryRes,
    guestProfilesRes,
    accessibilityRes,
  ] = await Promise.all([
    client.from('registrations').select('status').eq('event_id', eventId),
    client.from('users').select('id, role, is_active'),
    client.from('employee_profiles').select('user_id, home_country, department, years_attended'),
    client.from('dietary_preferences').select('restrictions, allergies, alcohol_free'),
    client.from('guest_profiles').select('payment_status'),
    client.from('accessibility_preferences').select('needs'),
  ]);

  if (registrationsRes.error) throw registrationsRes.error;
  if (usersRes.error) throw usersRes.error;
  if (employeeProfilesRes.error) throw employeeProfilesRes.error;
  if (dietaryRes.error) throw dietaryRes.error;
  if (guestProfilesRes.error) throw guestProfilesRes.error;
  if (accessibilityRes.error) throw accessibilityRes.error;

  // Funnel
  const funnel: RegistrationFunnel = { invited: 0, started: 0, complete: 0, cancelled: 0 };
  for (const row of registrationsRes.data ?? []) {
    const key = row.status;
    if (key in funnel) funnel[key] += 1;
  }

  // Roles
  const rolesMap = new Map<string, number>();
  for (const u of usersRes.data ?? []) {
    if (!u.is_active) continue;
    bumpCount(rolesMap, u.role);
  }

  // Countries + departments
  const countriesMap = new Map<string, number>();
  const departmentsMap = new Map<string, number>();
  const yearsMap = new Map<string, number>();
  for (const p of employeeProfilesRes.data ?? []) {
    if (p.home_country) bumpCount(countriesMap, p.home_country);
    if (p.department) bumpCount(departmentsMap, p.department);
    bumpCount(yearsMap, `${p.years_attended ?? 0}`);
  }

  // Dietary
  const restrictionsMap = new Map<string, number>();
  const allergiesMap = new Map<string, number>();
  let alcoholFreeCount = 0;
  let dietaryTotal = 0;
  for (const d of dietaryRes.data ?? []) {
    dietaryTotal += 1;
    if (d.alcohol_free) alcoholFreeCount += 1;
    for (const r of d.restrictions ?? []) bumpCount(restrictionsMap, r);
    for (const a of d.allergies ?? []) bumpCount(allergiesMap, a);
  }

  // Payments
  const paymentsMap = new Map<string, number>();
  for (const g of guestProfilesRes.data ?? []) bumpCount(paymentsMap, g.payment_status);

  // Accessibility
  const accessibilityMap = new Map<string, number>();
  for (const a of accessibilityRes.data ?? []) {
    for (const need of a.needs ?? []) bumpCount(accessibilityMap, need);
  }

  return {
    funnel,
    attendeesByRole: asEntries(rolesMap),
    attendeesByCountry: asEntries(countriesMap),
    attendeesByDepartment: asEntries(departmentsMap),
    dietaryRestrictions: asEntries(restrictionsMap),
    allergies: asEntries(allergiesMap),
    alcoholFreeShare: { freeOf: alcoholFreeCount, total: dietaryTotal },
    paymentStatus: asEntries(paymentsMap),
    yearsAttended: asNumericDistribution(yearsMap),
    accessibilityNeeds: asEntries(accessibilityMap),
  };
}
