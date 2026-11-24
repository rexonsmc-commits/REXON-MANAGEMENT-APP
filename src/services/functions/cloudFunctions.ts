import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { AccountStatus, OrganizationType } from '../../types';

export function isCloudFunctionsEnabled(): boolean {
  return (
    import.meta.env.VITE_USE_CLOUD_FUNCTIONS === 'true' ||
    import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  );
}

export function isCallableNotDeployedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    msg.includes('functions/not-found') ||
    msg.includes('functions/unavailable') ||
    msg.includes('failed to fetch') ||
    msg.includes('cors') ||
    msg.includes('not-found')
  );
}

export async function callInitializeSuperAdmin(payload: {
  fullName?: string;
  phone?: string;
  bootstrapSecret?: string;
}): Promise<{ success: boolean; superAdminUid: string }> {
  const fn = httpsCallable<typeof payload, { success: boolean; superAdminUid: string }>(
    functions,
    'initializeSuperAdmin'
  );
  const res = await fn(payload);
  return res.data;
}

export async function callCreateSuperAdminStaff(payload: {
  fullName: string;
  email: string;
  phone?: string;
  designation: string;
  department: string;
  loginId?: string;
  assignedRole: string;
  accountStatus: AccountStatus;
  permissions: string[];
}): Promise<{ success: boolean; staffId: string; uid: string; passwordSetupLinkGenerated: boolean }> {
  const fn = httpsCallable<
    typeof payload,
    { success: boolean; staffId: string; uid: string; passwordSetupLinkGenerated: boolean }
  >(functions, 'createSuperAdminStaff');
  const res = await fn(payload);
  return res.data;
}

export async function callCreateOrganization(payload: {
  organizationName: string;
  organizationType: OrganizationType;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  adminLoginEmail: string;
  loginId?: string;
  subscriptionPlanId?: string;
  subscriptionPlanName?: string;
  subscriptionStatus: string;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  accountStatus: AccountStatus;
}): Promise<{
  success: boolean;
  organizationId: string;
  adminUid: string;
  passwordSetupLinkGenerated: boolean;
}> {
  const fn = httpsCallable<
    typeof payload,
    {
      success: boolean;
      organizationId: string;
      adminUid: string;
      passwordSetupLinkGenerated: boolean;
    }
  >(functions, 'createOrganization');
  const res = await fn(payload);
  return res.data;
}

export async function callCreateOrganizationStaff(payload: {
  organizationId: string;
  employeeName: string;
  employeeId: string;
  email: string;
  phone?: string;
  designation: string;
  department: string;
  loginId?: string;
  assignedRole: string;
  permissions: string[];
  accountStatus: AccountStatus;
}): Promise<{ success: boolean; staffId: string; uid: string; passwordSetupLinkGenerated: boolean }> {
  const fn = httpsCallable<
    typeof payload,
    { success: boolean; staffId: string; uid: string; passwordSetupLinkGenerated: boolean }
  >(functions, 'createOrganizationStaff');
  const res = await fn(payload);
  return res.data;
}

export async function callDeactivateUser(payload: {
  targetUid: string;
  status?: 'inactive' | 'suspended' | 'disabled';
  reason?: string;
}): Promise<{ success: boolean; status: AccountStatus }> {
  const fn = httpsCallable<typeof payload, { success: boolean; status: AccountStatus }>(
    functions,
    'deactivateUser'
  );
  const res = await fn(payload);
  return res.data;
}

export async function callReactivateUser(payload: {
  targetUid: string;
}): Promise<{ success: boolean; status: AccountStatus }> {
  const fn = httpsCallable<typeof payload, { success: boolean; status: AccountStatus }>(
    functions,
    'reactivateUser'
  );
  const res = await fn(payload);
  return res.data;
}

export async function callUpdateStaffPermissions(payload: {
  targetUid: string;
  permissions: string[];
}): Promise<{ success: boolean; permissionsCount: number }> {
  const fn = httpsCallable<typeof payload, { success: boolean; permissionsCount: number }>(
    functions,
    'updateStaffPermissions'
  );
  const res = await fn(payload);
  return res.data;
}

export async function callResetOrInviteUserPassword(payload: {
  email: string;
}): Promise<{ success: boolean; passwordSetupLink?: string }> {
  const fn = httpsCallable<typeof payload, { success: boolean; passwordSetupLink?: string }>(
    functions,
    'resetOrInviteUserPassword'
  );
  const res = await fn(payload);
  return res.data;
}

export async function callResolveLoginId(identifier: string): Promise<{ email: string }> {
  const fn = httpsCallable<{ identifier: string }, { email: string }>(functions, 'resolveLoginId');
  const res = await fn({ identifier });
  return res.data;
}

export async function callWriteAuditLog(payload: {
  action: string;
  targetCollection: string;
  targetId: string;
  targetUserId?: string;
  organizationId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof payload, { success: boolean }>(functions, 'writeAuditLog');
  const res = await fn(payload);
  return res.data;
}
