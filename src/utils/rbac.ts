import { PERMISSION_ALIAS_MAP } from '../config/permissions';
import { AccountStatus, Organization, UserProfile, UserRole } from '../types';

export function getEffectiveAccountStatus(user: UserProfile | null | undefined): AccountStatus {
  if (!user) return 'inactive';
  return user.accountStatus || user.status || 'inactive';
}

export function isUserAccountActive(user: UserProfile | null | undefined): boolean {
  return getEffectiveAccountStatus(user) === 'active';
}

export function isSuperAdmin(user: UserProfile | null | undefined): boolean {
  return Boolean(user && user.role === 'super_admin' && isUserAccountActive(user));
}

export function isSuperAdminStaff(user: UserProfile | null | undefined): boolean {
  return Boolean(user && user.role === 'super_admin_staff' && isUserAccountActive(user));
}

export function isOrganizationAdmin(user: UserProfile | null | undefined): boolean {
  return Boolean(user && user.role === 'organization_admin' && isUserAccountActive(user));
}

export function isOrganizationStaff(user: UserProfile | null | undefined): boolean {
  return Boolean(user && user.role === 'organization_staff' && isUserAccountActive(user));
}

export function hasRole(user: UserProfile | null | undefined, roles: UserRole[]): boolean {
  if (!user || !isUserAccountActive(user)) return false;
  return roles.includes(user.role);
}

export function hasPermission(user: UserProfile | null | undefined, permission: string): boolean {
  if (!user || !isUserAccountActive(user)) return false;
  if (user.role === 'super_admin' || user.role === 'organization_admin') {
    return true;
  }
  const granted = user.permissions || [];
  if (granted.includes('all') || granted.includes(permission)) {
    return true;
  }
  const aliases = PERMISSION_ALIAS_MAP[permission] || [];
  return aliases.some((alias) => granted.includes(alias));
}

export function canAccessOrganization(
  user: UserProfile | null | undefined,
  organizationId: string
): boolean {
  if (!user || !isUserAccountActive(user)) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'super_admin_staff') {
    return hasPermission(user, 'manage_organizations') || hasPermission(user, 'platform.organizations.view');
  }
  return Boolean(user.organizationId && user.organizationId === organizationId);
}

export function isSubscriptionOperational(organization: Organization | null | undefined): boolean {
  if (!organization) return true;
  if (organization.accountStatus !== 'active') return false;
  return organization.subscriptionStatus !== 'Suspended' && organization.subscriptionStatus !== 'Expired';
}
