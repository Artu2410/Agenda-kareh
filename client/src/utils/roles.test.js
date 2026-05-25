import { describe, expect, it } from 'vitest';
import { formatRoleLabel, getAssignableRoleOptions, hasAnyRole, normalizeRole } from './roles';

describe('role utilities', () => {
  it('normalizes and matches roles case-insensitively', () => {
    expect(normalizeRole(' super_user ')).toBe('SUPER_USER');
    expect(hasAnyRole(' secretaria ', ['ADMIN', 'SECRETARIA'])).toBe(true);
    expect(hasAnyRole('professional', ['ADMIN', 'SECRETARIA'])).toBe(false);
  });

  it('returns operational roles for admins and all roles for super users', () => {
    expect(getAssignableRoleOptions()).toEqual([
      { value: 'PROFESSIONAL', label: 'PROFESSIONAL' },
      { value: 'SECRETARIA', label: 'SECRETARIA' },
    ]);

    expect(getAssignableRoleOptions({ canManageAdminRoles: true })).toEqual([
      { value: 'SUPER_USER', label: 'SUPER_USER' },
      { value: 'ADMIN', label: 'ADMIN' },
      { value: 'PROFESSIONAL', label: 'PROFESSIONAL' },
      { value: 'SECRETARIA', label: 'SECRETARIA' },
    ]);
  });

  it('preserves the canonical label for stored backend roles', () => {
    expect(formatRoleLabel('SUPER_USER')).toBe('SUPER_USER');
    expect(formatRoleLabel('PROFESSIONAL')).toBe('PROFESSIONAL');
    expect(formatRoleLabel('')).toBe('SIN_ROL');
  });
});
