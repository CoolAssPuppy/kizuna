import { describe, expect, it } from 'vitest';

import { hasRole } from './hooks';

describe('hasRole', () => {
  it('returns false for a null role', () => {
    expect(hasRole(null, ['admin', 'super_admin'])).toBe(false);
  });

  it('returns true when the role is in the allow list', () => {
    expect(hasRole('admin', ['admin', 'super_admin'])).toBe(true);
    expect(hasRole('super_admin', ['admin', 'super_admin'])).toBe(true);
  });

  it('returns false when the role is not in the allow list', () => {
    expect(hasRole('employee', ['admin', 'super_admin'])).toBe(false);
    expect(hasRole('guest', ['admin'])).toBe(false);
  });
});
