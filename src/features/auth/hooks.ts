import { useAuth } from './AuthContext';
import type { AppRole } from './types';

const ADMIN_ROLES = ['admin', 'super_admin'] as const satisfies ReadonlyArray<AppRole>;

export function useRole(): AppRole | null {
  return useAuth().user?.role ?? null;
}

export function useIsAdmin(): boolean {
  const role = useRole();
  return hasRole(role, ADMIN_ROLES);
}

export function useIsSuperAdmin(): boolean {
  return useRole() === 'super_admin';
}

export function hasRole(role: AppRole | null, allowed: ReadonlyArray<AppRole>): boolean {
  return role !== null && allowed.includes(role);
}
