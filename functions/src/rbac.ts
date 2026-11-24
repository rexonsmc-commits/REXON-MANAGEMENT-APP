import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';

export type UserRole =
  | 'super_admin'
  | 'super_admin_staff'
  | 'organization_admin'
  | 'organization_staff';

export type AccountStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'disabled';

export interface TrustedActor {
  uid: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  permissions: string[];
  status: AccountStatus;
}

export const PERMISSION_ALIASES: Record<string, string[]> = {
  'platform.dashboard.view': ['view_dashboard'],
  'platform.organizations.view': ['manage_organizations'],
  'platform.organizations.create': ['create_organizations', 'manage_organizations'],
  'platform.organizations.edit': ['edit_organizations', 'manage_organizations'],
  'platform.organizations.delete': ['delete_organizations'],
  'platform.staff.view': ['manage_staff'],
  'platform.staff.create': ['manage_staff'],
  'platform.staff.edit': ['manage_staff'],
  'platform.staff.delete': ['manage_staff'],
  'platform.subscriptions.view': ['manage_plans', 'view_payments'],
  'platform.subscriptions.create': ['manage_plans'],
  'platform.subscriptions.edit': ['manage_plans'],
  'platform.subscriptions.delete': ['manage_plans'],
  'platform.reports.view': ['manage_reports'],
  'platform.reports.export': ['export_pdf'],
  'organization.dashboard.view': ['view_dashboard'],
  'organization.profile.view': ['view_dashboard'],
  'organization.profile.edit': ['access_settings'],
  'organization.staff.view': ['view_staff', 'manage_staff'],
  'organization.staff.create': ['manage_staff'],
  'organization.staff.edit': ['manage_staff'],
  'organization.staff.delete': ['manage_staff'],
  'organization.roles.manage': ['manage_staff'],
  'organization.properties.view': ['view_properties', 'manage_properties'],
  'organization.properties.manage': ['manage_properties'],
  'organization.reports.view': ['view_reports'],
  'organization.reports.export': ['export_pdf'],
};

export function hasBackendPermission(actor: TrustedActor, permission: string): boolean {
  if (actor.status !== 'active') return false;
  if (actor.role === 'super_admin' || actor.role === 'organization_admin') {
    return true;
  }
  if (actor.permissions.includes('all') || actor.permissions.includes(permission)) {
    return true;
  }
  const aliases = PERMISSION_ALIASES[permission] || [];
  return aliases.some((alias) => actor.permissions.includes(alias));
}

export async function requireActiveActor(uid?: string): Promise<TrustedActor> {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No trusted user profile exists for this account.');
  }

  const data = snap.data()!;
  const effectiveStatus = (data.accountStatus || data.status || 'inactive') as AccountStatus;

  if (effectiveStatus !== 'active') {
    throw new HttpsError(
      'permission-denied',
      `Your account is currently ${effectiveStatus}. Contact your administrator.`
    );
  }

  return {
    uid,
    email: String(data.email || '').toLowerCase(),
    role: data.role as UserRole,
    organizationId: data.organizationId ? String(data.organizationId) : undefined,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    status: effectiveStatus,
  };
}

export async function assertSuperAdmin(uid?: string): Promise<TrustedActor> {
  const actor = await requireActiveActor(uid);
  const mainConfigSnap = await adminDb.collection('systemConfig').doc('main').get();

  if (
    actor.role !== 'super_admin' ||
    (mainConfigSnap.exists && mainConfigSnap.data()?.superAdminUid !== actor.uid)
  ) {
    throw new HttpsError('permission-denied', 'Only the unique Super Admin can perform this action.');
  }
  return actor;
}

export async function recordServerAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  organizationId?: string;
  action: string;
  targetCollection: string;
  targetId: string;
  targetUserId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const logRef = adminDb.collection('auditLogs').doc();
  const payload: Record<string, unknown> = {
    id: logRef.id,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    action: params.action,
    targetCollection: params.targetCollection,
    targetId: params.targetId,
    summary: params.summary.slice(0, 300),
    createdAt: FieldValue.serverTimestamp(),
  };
  if (params.organizationId) payload.organizationId = params.organizationId;
  if (params.targetUserId) payload.targetUserId = params.targetUserId;
  if (params.metadata) payload.metadata = params.metadata;
  await logRef.set(payload);
}
