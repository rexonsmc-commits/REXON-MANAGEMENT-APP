import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FIELD_LIMITS } from '../../config/permissions';
import {
  OrganizationStaff,
  RoleTemplate,
  SuperAdminStaff,
  UserProfile,
} from '../../types';
import { generateSafeId, requestPasswordReset } from '../auth/authService';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  callCreateOrganizationStaff,
  callCreateSuperAdminStaff,
  callDeactivateUser,
  callReactivateUser,
  callResetOrInviteUserPassword,
  callUpdateStaffPermissions,
  isCallableNotDeployedError,
  isCloudFunctionsEnabled,
} from '../functions/cloudFunctions';
import { createAuditLog } from '../subscriptions/subscriptionService';

function sanitizeLoginId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 80);
  return cleaned.length >= 2 ? cleaned : undefined;
}

// =========================================================================
// SUPER ADMIN STAFF
// =========================================================================

export async function listSuperAdminStaff(): Promise<SuperAdminStaff[]> {
  try {
    const snap = await getDocs(collection(db, 'superAdminStaff'));
    return snap.docs.map((d) => d.data() as SuperAdminStaff);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'superAdminStaff');
  }
}

export async function createSuperAdminStaff(
  input: Omit<SuperAdminStaff, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<SuperAdminStaff> {
  const emailLower = input.email.trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX);
  const loginId = sanitizeLoginId(input.loginId);

  if (isCloudFunctionsEnabled()) {
    try {
      const res = await callCreateSuperAdminStaff({
        fullName: input.name,
        email: emailLower,
        phone: input.phone,
        designation: input.designation,
        department: input.department,
        loginId,
        assignedRole: input.assignedRole,
        accountStatus: input.status,
        permissions: input.permissions,
      });
      const created = await getDoc(doc(db, 'superAdminStaff', res.staffId));
      if (created.exists()) return created.data() as SuperAdminStaff;
      return { ...(input as SuperAdminStaff), id: res.staffId, uid: res.uid, createdBy: actor.uid };
    } catch (fnErr) {
      if (!isCallableNotDeployedError(fnErr)) {
        throw fnErr;
      }
    }
  }

  const id = generateSafeId('sastaff');
  const payload: Record<string, unknown> = {
    id,
    name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    email: emailLower,
    designation: input.designation.trim().slice(0, 100),
    department: input.department.trim().slice(0, 100),
    assignedRole: input.assignedRole.trim().slice(0, 100),
    permissions: input.permissions.slice(0, 40),
    status: input.status,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.phone) payload.phone = input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
  if (loginId) payload.loginId = loginId;

  try {
    await setDoc(doc(db, 'superAdminStaff', id), payload);

    const invitePayload: Record<string, unknown> = {
      email: emailLower,
      displayName: payload.name,
      role: 'super_admin_staff',
      designation: payload.designation,
      department: payload.department,
      permissions: payload.permissions,
      status: payload.status,
      invitedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.phone) invitePayload.phone = input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
    if (loginId) invitePayload.loginId = loginId;

    await setDoc(doc(db, 'invitedAccounts', emailLower), invitePayload);

    if (loginId) {
      await setDoc(doc(db, 'loginDirectory', loginId), {
        loginId,
        email: emailLower,
        role: 'super_admin_staff',
        accountStatus: input.status,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await createAuditLog(actor, {
      action: 'CREATE_SUPER_ADMIN_STAFF',
      targetCollection: 'superAdminStaff',
      targetId: id,
      summary: `Created Super Admin Staff "${String(payload.name)}" (${emailLower})`,
    });

    return { ...(payload as unknown as SuperAdminStaff), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `superAdminStaff/${id}`);
  }
}

export async function updateSuperAdminStaff(
  staffId: string,
  updates: Partial<SuperAdminStaff>,
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'superAdminStaff', staffId));
    if (!snap.exists()) throw new Error('Staff record not found');
    const cur = snap.data() as SuperAdminStaff;
    const emailLower = (updates.email ?? cur.email).trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX);
    const loginId = sanitizeLoginId(updates.loginId ?? cur.loginId);
    const nextPhone = updates.phone ?? cur.phone;

    const payload: Record<string, unknown> = {
      id: cur.id,
      name: (updates.name ?? cur.name).trim().slice(0, FIELD_LIMITS.NAME_MAX),
      email: emailLower,
      designation: (updates.designation ?? cur.designation).trim().slice(0, 100),
      department: (updates.department ?? cur.department).trim().slice(0, 100),
      assignedRole: (updates.assignedRole ?? cur.assignedRole).trim().slice(0, 100),
      permissions: (updates.permissions ?? cur.permissions).slice(0, 40),
      status: updates.status ?? cur.status,
      createdBy: cur.createdBy,
      createdAt: cur.createdAt,
      updatedAt: serverTimestamp(),
    };
    if (cur.uid) payload.uid = cur.uid;
    if (nextPhone) payload.phone = nextPhone.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
    if (loginId) payload.loginId = loginId;

    await updateDoc(doc(db, 'superAdminStaff', staffId), payload);

    const inviteSnap = await getDoc(doc(db, 'invitedAccounts', emailLower));
    if (inviteSnap.exists()) {
      await updateDoc(doc(db, 'invitedAccounts', emailLower), {
        displayName: payload.name,
        designation: payload.designation,
        department: payload.department,
        permissions: payload.permissions,
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
    }

    const userQ = query(collection(db, 'users'), where('email', '==', emailLower));
    const userSnaps = await getDocs(userQ);
    for (const uDoc of userSnaps.docs) {
      const uData = uDoc.data() as UserProfile;
      if (uData.role === 'super_admin_staff') {
        if (isCloudFunctionsEnabled()) {
          if (updates.permissions) {
            await callUpdateStaffPermissions({
              targetUid: uDoc.id,
              permissions: payload.permissions as string[],
            }).catch(() => undefined);
          }
          if (updates.status && updates.status !== cur.status) {
            if (updates.status === 'active') {
              await callReactivateUser({ targetUid: uDoc.id }).catch(() => undefined);
            } else if (
              updates.status === 'inactive' ||
              updates.status === 'suspended' ||
              updates.status === 'disabled'
            ) {
              await callDeactivateUser({ targetUid: uDoc.id, status: updates.status }).catch(
                () => undefined
              );
            }
          }
        }
        await updateDoc(doc(db, 'users', uDoc.id), {
          displayName: payload.name,
          fullName: payload.name,
          designation: payload.designation,
          department: payload.department,
          permissions: payload.permissions,
          status: payload.status,
          accountStatus: payload.status,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await createAuditLog(actor, {
      action: 'UPDATE_SUPER_ADMIN_STAFF',
      targetCollection: 'superAdminStaff',
      targetId: staffId,
      summary: `Updated Super Admin Staff "${String(payload.name)}" (${String(payload.status)})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `superAdminStaff/${staffId}`);
  }
}

export async function deleteSuperAdminStaff(
  staffId: string,
  name: string,
  actor: UserProfile
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'superAdminStaff', staffId));
    await createAuditLog(actor, {
      action: 'DELETE_SUPER_ADMIN_STAFF',
      targetCollection: 'superAdminStaff',
      targetId: staffId,
      summary: `Removed Super Admin Staff "${name}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `superAdminStaff/${staffId}`);
  }
}

// =========================================================================
// ORGANIZATION STAFF (Tenant-Isolated)
// =========================================================================

export async function listOrganizationStaff(organizationId: string): Promise<OrganizationStaff[]> {
  try {
    const q = query(
      collection(db, 'organizationStaff'),
      where('organizationId', '==', organizationId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OrganizationStaff);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'organizationStaff');
  }
}

export async function listAllOrganizationStaffGlobal(): Promise<OrganizationStaff[]> {
  try {
    const snap = await getDocs(collection(db, 'organizationStaff'));
    return snap.docs.map((d) => d.data() as OrganizationStaff);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'organizationStaff');
  }
}

export async function createOrganizationStaff(
  input: Omit<OrganizationStaff, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile,
  organizationName?: string
): Promise<OrganizationStaff> {
  const emailLower = input.email.trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX);
  const loginId = sanitizeLoginId(input.loginId);

  if (isCloudFunctionsEnabled()) {
    try {
      const res = await callCreateOrganizationStaff({
        organizationId: input.organizationId,
        employeeName: input.name,
        employeeId: input.employeeId,
        email: emailLower,
        phone: input.phone,
        designation: input.designation,
        department: input.department,
        loginId,
        assignedRole: input.role,
        permissions: input.permissions,
        accountStatus: input.status,
      });
      const created = await getDoc(doc(db, 'organizationStaff', res.staffId));
      if (created.exists()) return created.data() as OrganizationStaff;
      return { ...(input as OrganizationStaff), id: res.staffId, uid: res.uid, createdBy: actor.uid };
    } catch (fnErr) {
      if (!isCallableNotDeployedError(fnErr)) {
        throw fnErr;
      }
    }
  }

  const id = generateSafeId('orgstaff');
  const payload: Record<string, unknown> = {
    id,
    organizationId: input.organizationId,
    employeeId: input.employeeId.trim().slice(0, 60),
    name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    email: emailLower,
    designation: input.designation.trim().slice(0, 100),
    department: input.department.trim().slice(0, 100),
    role: input.role.trim().slice(0, 100),
    permissions: input.permissions.slice(0, 40),
    status: input.status,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.phone) payload.phone = input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
  if (loginId) payload.loginId = loginId;

  try {
    await setDoc(doc(db, 'organizationStaff', id), payload);

    const invitePayload: Record<string, unknown> = {
      email: emailLower,
      displayName: payload.name,
      employeeId: payload.employeeId,
      role: 'organization_staff',
      organizationId: payload.organizationId,
      organizationName: (organizationName || actor.organizationName || 'Organization').slice(
        0,
        FIELD_LIMITS.ORG_NAME_MAX
      ),
      designation: payload.designation,
      department: payload.department,
      permissions: payload.permissions,
      status: payload.status,
      invitedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.phone) invitePayload.phone = input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
    if (loginId) invitePayload.loginId = loginId;

    await setDoc(doc(db, 'invitedAccounts', emailLower), invitePayload);

    if (loginId) {
      await setDoc(doc(db, 'loginDirectory', loginId), {
        loginId,
        email: emailLower,
        role: 'organization_staff',
        organizationId: payload.organizationId,
        accountStatus: input.status,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await createAuditLog(actor, {
      organizationId: input.organizationId,
      action: 'CREATE_ORG_STAFF',
      targetCollection: 'organizationStaff',
      targetId: id,
      summary: `Created organization staff "${String(payload.name)}" (${String(payload.employeeId)})`,
    });

    return { ...(payload as unknown as OrganizationStaff), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `organizationStaff/${id}`);
  }
}

export async function updateOrganizationStaff(
  staffId: string,
  updates: Partial<OrganizationStaff>,
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'organizationStaff', staffId));
    if (!snap.exists()) throw new Error('Staff member not found');
    const cur = snap.data() as OrganizationStaff;
    const emailLower = (updates.email ?? cur.email).trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX);
    const loginId = sanitizeLoginId(updates.loginId ?? cur.loginId);
    const nextPhone = updates.phone ?? cur.phone;

    const payload: Record<string, unknown> = {
      id: cur.id,
      organizationId: cur.organizationId,
      employeeId: (updates.employeeId ?? cur.employeeId).trim().slice(0, 60),
      name: (updates.name ?? cur.name).trim().slice(0, FIELD_LIMITS.NAME_MAX),
      email: emailLower,
      designation: (updates.designation ?? cur.designation).trim().slice(0, 100),
      department: (updates.department ?? cur.department).trim().slice(0, 100),
      role: (updates.role ?? cur.role).trim().slice(0, 100),
      permissions: (updates.permissions ?? cur.permissions).slice(0, 40),
      status: updates.status ?? cur.status,
      createdBy: cur.createdBy,
      createdAt: cur.createdAt,
      updatedAt: serverTimestamp(),
    };
    if (cur.uid) payload.uid = cur.uid;
    if (nextPhone) payload.phone = nextPhone.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
    if (loginId) payload.loginId = loginId;

    await updateDoc(doc(db, 'organizationStaff', staffId), payload);

    const inviteSnap = await getDoc(doc(db, 'invitedAccounts', emailLower));
    if (inviteSnap.exists()) {
      await updateDoc(doc(db, 'invitedAccounts', emailLower), {
        displayName: payload.name,
        designation: payload.designation,
        department: payload.department,
        permissions: payload.permissions,
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
    }

    // Sync active/claimed user document scoped to this organization
    const userQ = query(
      collection(db, 'users'),
      where('organizationId', '==', cur.organizationId)
    );
    const userSnaps = await getDocs(userQ);
    for (const uDoc of userSnaps.docs) {
      const uData = uDoc.data() as UserProfile;
      if (uData.email.toLowerCase() === emailLower && uData.role === 'organization_staff') {
        if (isCloudFunctionsEnabled()) {
          if (updates.permissions) {
            await callUpdateStaffPermissions({
              targetUid: uDoc.id,
              permissions: payload.permissions as string[],
            }).catch(() => undefined);
          }
          if (updates.status && updates.status !== cur.status) {
            if (updates.status === 'active') {
              await callReactivateUser({ targetUid: uDoc.id }).catch(() => undefined);
            } else if (
              updates.status === 'inactive' ||
              updates.status === 'suspended' ||
              updates.status === 'disabled'
            ) {
              await callDeactivateUser({ targetUid: uDoc.id, status: updates.status }).catch(
                () => undefined
              );
            }
          }
        }
        await updateDoc(doc(db, 'users', uDoc.id), {
          displayName: payload.name,
          fullName: payload.name,
          designation: payload.designation,
          department: payload.department,
          permissions: payload.permissions,
          status: payload.status,
          accountStatus: payload.status,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await createAuditLog(actor, {
      organizationId: cur.organizationId,
      action: 'UPDATE_ORG_STAFF',
      targetCollection: 'organizationStaff',
      targetId: staffId,
      summary: `Updated organization staff "${String(payload.name)}" (${String(payload.status)})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `organizationStaff/${staffId}`);
  }
}

export async function issuePasswordSetupInvite(email: string): Promise<string> {
  const emailLower = email.trim().toLowerCase();
  if (isCloudFunctionsEnabled()) {
    try {
      const res = await callResetOrInviteUserPassword({ email: emailLower });
      if (res.passwordSetupLink) {
        return 'Backend password setup link generated via Firebase Admin SDK.';
      }
    } catch (fnErr) {
      if (!isCallableNotDeployedError(fnErr)) {
        // Fallback to Firebase Auth password reset email below
      }
    }
  }
  await requestPasswordReset(emailLower);
  return `Password setup / reset email dispatched to ${emailLower}.`;
}

export async function deleteOrganizationStaff(
  staffId: string,
  organizationId: string,
  name: string,
  actor: UserProfile
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'organizationStaff', staffId));
    await createAuditLog(actor, {
      organizationId,
      action: 'DELETE_ORG_STAFF',
      targetCollection: 'organizationStaff',
      targetId: staffId,
      summary: `Removed organization staff "${name}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `organizationStaff/${staffId}`);
  }
}

// =========================================================================
// ROLE TEMPLATES
// =========================================================================

export async function listRoleTemplates(organizationId: string): Promise<RoleTemplate[]> {
  try {
    const q = query(collection(db, 'roles'), where('organizationId', '==', organizationId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as RoleTemplate);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'roles');
  }
}

export async function createRoleTemplate(
  input: Omit<RoleTemplate, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<RoleTemplate> {
  const id = generateSafeId('role');
  const payload: Record<string, unknown> = {
    id,
    organizationId: input.organizationId,
    name: input.name.trim().slice(0, 100),
    permissions: input.permissions.slice(0, 40),
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.description) {
    payload.description = input.description.trim().slice(0, 240);
  }
  try {
    await setDoc(doc(db, 'roles', id), payload);
    await createAuditLog(actor, {
      organizationId: input.organizationId,
      action: 'CREATE_ROLE_TEMPLATE',
      targetCollection: 'roles',
      targetId: id,
      summary: `Created role template "${input.name}"`,
    });
    return { ...(payload as unknown as RoleTemplate), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `roles/${id}`);
  }
}

export async function deleteRoleTemplate(
  roleId: string,
  organizationId: string,
  actor: UserProfile
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'roles', roleId));
    await createAuditLog(actor, {
      organizationId,
      action: 'DELETE_ROLE_TEMPLATE',
      targetCollection: 'roles',
      targetId: roleId,
      summary: `Deleted role template ${roleId}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `roles/${roleId}`);
  }
}
