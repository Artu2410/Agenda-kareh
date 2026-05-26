import { ROLES } from '../src/constants/roles.js';
import { canAssignRole, isAdmin, isAdminManagedRole, isProfessionalUser, isSecretaryUser, isSuperUser } from '../src/utils/roles.js';

describe('Role utilities', () => {
  it('should expose canonical roles and keep legacy aliases mapped', () => {
    expect(ROLES.SUPER_USER).toBe('SUPER_USER');
    expect(ROLES.ADMIN).toBe('ADMIN');
    expect(ROLES.PROFESSIONAL).toBe('PROFESSIONAL');
    expect(ROLES.SECRETARIA).toBe('SECRETARIA');
    expect(ROLES.SUPER_ADMIN).toBe('SUPER_USER');
    expect(ROLES.KINESIOLOGO).toBe('PROFESSIONAL');
  });

  it('should classify roles correctly', () => {
    expect(isSuperUser({ role: 'SUPER_USER' })).toBe(true);
    expect(isAdmin({ role: 'SUPER_USER' })).toBe(true);
    expect(isAdmin({ role: 'ADMIN' })).toBe(true);
    expect(isProfessionalUser({ role: 'PROFESSIONAL' })).toBe(true);
    expect(isSecretaryUser({ role: 'SECRETARIA' })).toBe(true);
    expect(isAdminManagedRole('PROFESSIONAL')).toBe(true);
    expect(isAdminManagedRole('SECRETARIA')).toBe(true);
    expect(isAdminManagedRole('ADMIN')).toBe(false);
  });

  it('should allow super users to assign all roles', () => {
    const currentUser = { role: 'SUPER_USER' };

    expect(canAssignRole(currentUser, 'SUPER_USER')).toBe(true);
    expect(canAssignRole(currentUser, 'ADMIN')).toBe(true);
    expect(canAssignRole(currentUser, 'PROFESSIONAL')).toBe(true);
    expect(canAssignRole(currentUser, 'SECRETARIA')).toBe(true);
  });

  it('should only allow admins to assign operational roles', () => {
    const currentUser = { role: 'ADMIN' };

    expect(canAssignRole(currentUser, 'PROFESSIONAL')).toBe(true);
    expect(canAssignRole(currentUser, 'SECRETARIA')).toBe(true);
    expect(canAssignRole(currentUser, 'ADMIN')).toBe(false);
    expect(canAssignRole(currentUser, 'SUPER_USER')).toBe(false);
  });
});
