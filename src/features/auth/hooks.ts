import { useAuth } from './AuthContext';
import type { AppRole } from './types';

const ADMIN_ROLES = ['admin', 'super_admin'] as const satisfies ReadonlyArray<AppRole>;

export function useIsAdmin(): boolean {
  const role = useAuth().user?.role ?? null;
  return hasRole(role, ADMIN_ROLES);
}

export function hasRole(role: AppRole | null, allowed: ReadonlyArray<AppRole>): boolean {
  return role !== null && allowed.includes(role);
}
