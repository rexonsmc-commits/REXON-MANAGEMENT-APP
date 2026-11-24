import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb, ENFORCE_APP_CHECK } from './firebaseAdmin';
import {
  assertSuperAdmin,
  hasBackendPermission,
  recordServerAuditLog,
  requireActiveActor,
  AccountStatus,
} from './rbac';

const callableOptions = {
  enforceAppCheck: ENFORCE_APP_CHECK,
  cors: true,
};

function generateTempPassword(): string {
  // Never returned to the frontend; user activates via password reset/setup link
  return `Rxn!${Math.random().toString(36).slice(2)}#${Date.now().toString(36)}A9`;
}

function normalizeLoginId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

// -----------------------------------------------------------------------------
// 1. initializeSuperAdmin (Write-Once Atomic Provisioning)
// -----------------------------------------------------------------------------
const initSuperAdminSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional(),
  bootstrapSecret: z.string().min(8).optional(),
});

export const initializeSuperAdmin = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in is required to initialize Super Admin.');
  }

  const parsed = initSuperAdminSchema.safeParse(request.data || {});
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid initialization payload.');
  }

  const configuredEmail = (process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || 'rexon.smc@gmail.com')
    .trim()
    .toLowerCase();
  const configuredSecret = process.env.SUPER_ADMIN_BOOTSTRAP_SECRET;

  const callerEmail = String(request.auth.token.email || '').trim().toLowerCase();
  const emailVerified = request.auth.token.email_verified === true;

  if (!emailVerified || callerEmail !== configuredEmail) {
    throw new HttpsError(
      'permission-denied',
      'Only the authorized deployment Super Admin email may initialize root authority.'
    );
  }

  if (configuredSecret && parsed.data.bootstrapSecret !== configuredSecret) {
    throw new HttpsError('permission-denied', 'Invalid Super Admin deployment verification secret.');
  }

  const uid = request.auth.uid;
  const mainRef = adminDb.collection('systemConfig').doc('main');
  const legacyRef = adminDb.collection('systemConfig').doc('superAdmin');
  const userRef = adminDb.collection('users').doc(uid);

  await adminDb.runTransaction(async (tx) => {
    const mainSnap = await tx.get(mainRef);
    const legacySnap = await tx.get(legacyRef);

    if (mainSnap.exists && mainSnap.data()?.initialized === true) {
      throw new HttpsError(
        'already-exists',
        'Super Admin has already been initialized. A second Super Admin cannot be created.'
      );
    }
    if (legacySnap.exists && legacySnap.data()?.superAdminUid !== uid) {
      throw new HttpsError(
        'already-exists',
        'Super Admin root configuration is already bound to another account.'
      );
    }

    const displayName = (parsed.data.fullName || 'Super Administrator').trim().slice(0, 120);

    tx.set(mainRef, {
      superAdminUid: uid,
      email: callerEmail,
      initialized: true,
      platformName: 'REXON MANAGEMENT APP',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!legacySnap.exists) {
      tx.set(legacyRef, {
        superAdminUid: uid,
        email: callerEmail,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(
      userRef,
      {
        uid,
        email: callerEmail,
        displayName,
        fullName: displayName,
        phone: parsed.data.phone || '',
        role: 'super_admin',
        designation: 'Platform Super Administrator',
        department: 'Global Governance',
        permissions: ['all'],
        status: 'active',
        accountStatus: 'active',
        emailVerified: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await adminAuth.setCustomUserClaims(uid, { role: 'super_admin' });

  await recordServerAuditLog({
    actorUid: uid,
    actorEmail: callerEmail,
    actorRole: 'super_admin',
    action: 'SUPER_ADMIN_INITIALIZED',
    targetCollection: 'systemConfig',
    targetId: 'main',
    targetUserId: uid,
    summary: `Initialized unique Super Admin account (${callerEmail})`,
  });

  return { success: true, superAdminUid: uid };
});

// -----------------------------------------------------------------------------
// 2. createSuperAdminStaff
// -----------------------------------------------------------------------------
const createSuperAdminStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional(),
  designation: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  loginId: z.string().max(80).optional(),
  assignedRole: z.string().min(1).max(100),
  accountStatus: z.enum(['pending', 'active', 'inactive', 'suspended', 'disabled']).default('active'),
  permissions: z.array(z.string().max(80)).max(40),
});

export const createSuperAdminStaff = onCall(callableOptions, async (request) => {
  const actor = await assertSuperAdmin(request.auth?.uid);

  const parsed = createSuperAdminStaffSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message || 'Invalid staff input.');
  }

  const input = parsed.data;
  const emailLower = input.email.trim().toLowerCase();
  const loginId = normalizeLoginId(input.loginId);

  if (loginId) {
    const existingLogin = await adminDb.collection('loginDirectory').doc(loginId).get();
    if (existingLogin.exists) {
      throw new HttpsError('already-exists', `Login ID "${loginId}" is already assigned.`);
    }
  }

  let targetUid = '';
  try {
    const existingAuth = await adminAuth.getUserByEmail(emailLower).catch(() => null);
    if (existingAuth) {
      targetUid = existingAuth.uid;
    } else {
      const createdUser = await adminAuth.createUser({
        email: emailLower,
        password: generateTempPassword(),
        displayName: input.fullName.trim(),
        disabled: input.accountStatus !== 'active' && input.accountStatus !== 'pending',
      });
      targetUid = createdUser.uid;
    }
  } catch (err) {
    throw new HttpsError(
      'internal',
      err instanceof Error ? err.message : 'Failed to create Firebase Auth account.'
    );
  }

  await adminAuth.setCustomUserClaims(targetUid, { role: 'super_admin_staff' });
  const resetLink = await adminAuth.generatePasswordResetLink(emailLower).catch(() => null);

  const staffRef = adminDb.collection('superAdminStaff').doc();
  const batch = adminDb.batch();

  batch.set(staffRef, {
    id: staffRef.id,
    uid: targetUid,
    name: input.fullName.trim(),
    email: emailLower,
    phone: input.phone?.trim() || '',
    loginId: loginId || '',
    designation: input.designation.trim(),
    department: input.department.trim(),
    assignedRole: input.assignedRole.trim(),
    permissions: input.permissions,
    status: input.accountStatus,
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('users').doc(targetUid), {
    uid: targetUid,
    email: emailLower,
    displayName: input.fullName.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || '',
    loginId: loginId || '',
    role: 'super_admin_staff',
    designation: input.designation.trim(),
    department: input.department.trim(),
    permissions: input.permissions,
    status: input.accountStatus,
    accountStatus: input.accountStatus,
    emailVerified: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('invitedAccounts').doc(emailLower), {
    email: emailLower,
    displayName: input.fullName.trim(),
    phone: input.phone?.trim() || '',
    loginId: loginId || '',
    role: 'super_admin_staff',
    designation: input.designation.trim(),
    department: input.department.trim(),
    permissions: input.permissions,
    status: input.accountStatus,
    invitedBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (loginId) {
    batch.set(adminDb.collection('loginDirectory').doc(loginId), {
      loginId,
      email: emailLower,
      uid: targetUid,
      role: 'super_admin_staff',
      accountStatus: input.accountStatus,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'USER_CREATED_SUPER_ADMIN_STAFF',
    targetCollection: 'superAdminStaff',
    targetId: staffRef.id,
    targetUserId: targetUid,
    summary: `Created Super Admin Staff "${input.fullName}" (${emailLower})`,
  });

  return {
    success: true,
    staffId: staffRef.id,
    uid: targetUid,
    passwordSetupLinkGenerated: Boolean(resetLink),
  };
});

// -----------------------------------------------------------------------------
// 3. createOrganization
// -----------------------------------------------------------------------------
const createOrganizationSchema = z.object({
  organizationName: z.string().min(2).max(160),
  organizationType: z.enum([
    'Company',
    'Factory',
    'Society',
    'Apartment',
    'Industry',
    'Commercial Building',
    'Other',
  ]),
  contactPerson: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(5).max(40),
  address: z.string().min(3).max(300),
  adminLoginEmail: z.string().email().max(160),
  loginId: z.string().max(80).optional(),
  subscriptionPlanId: z.string().max(128).optional(),
  subscriptionPlanName: z.string().max(120).optional(),
  subscriptionStatus: z.enum(['Pending', 'Active', 'Expired', 'Suspended', 'Cancelled']),
  subscriptionStartDate: z.string().max(40).optional(),
  subscriptionExpiryDate: z.string().max(40).optional(),
  accountStatus: z.enum(['pending', 'active', 'inactive', 'suspended', 'disabled']).default('active'),
});

export const createOrganization = onCall(callableOptions, async (request) => {
  const actor = await assertSuperAdmin(request.auth?.uid);

  const parsed = createOrganizationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      parsed.error.issues[0]?.message || 'Invalid organization payload.'
    );
  }

  const input = parsed.data;
  const adminEmail = input.adminLoginEmail.trim().toLowerCase();
  const loginId = normalizeLoginId(input.loginId);

  if (input.subscriptionPlanId) {
    const planSnap = await adminDb
      .collection('subscriptionPlans')
      .doc(input.subscriptionPlanId)
      .get();
    if (!planSnap.exists && !input.subscriptionPlanName) {
      throw new HttpsError('not-found', 'Referenced subscription plan does not exist.');
    }
  }

  if (loginId) {
    const existingLogin = await adminDb.collection('loginDirectory').doc(loginId).get();
    if (existingLogin.exists) {
      throw new HttpsError('already-exists', `Login ID "${loginId}" is already assigned.`);
    }
  }

  let adminUid = '';
  const existingAuth = await adminAuth.getUserByEmail(adminEmail).catch(() => null);
  if (existingAuth) {
    adminUid = existingAuth.uid;
  } else {
    const createdAdmin = await adminAuth.createUser({
      email: adminEmail,
      password: generateTempPassword(),
      displayName: input.contactPerson.trim(),
      disabled: input.accountStatus !== 'active' && input.accountStatus !== 'pending',
    });
    adminUid = createdAdmin.uid;
  }

  const orgRef = adminDb.collection('organizations').doc();
  const orgId = orgRef.id;

  await adminAuth.setCustomUserClaims(adminUid, {
    role: 'organization_admin',
    organizationId: orgId,
  });
  const resetLink = await adminAuth.generatePasswordResetLink(adminEmail).catch(() => null);

  const orgAdminPermissions = [
    'organization.dashboard.view',
    'organization.profile.view',
    'organization.profile.edit',
    'organization.staff.view',
    'organization.staff.create',
    'organization.staff.edit',
    'organization.staff.delete',
    'organization.roles.manage',
    'organization.properties.view',
    'organization.properties.manage',
    'organization.reports.view',
    'organization.reports.export',
    'view_dashboard',
    'view_staff',
    'manage_staff',
    'view_properties',
    'manage_properties',
    'view_reports',
    'export_pdf',
    'access_settings',
  ];

  const batch = adminDb.batch();
  batch.set(orgRef, {
    id: orgId,
    organizationId: orgId,
    name: input.organizationName.trim(),
    type: input.organizationType,
    contactPerson: input.contactPerson.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    adminLoginEmail: adminEmail,
    adminLoginId: loginId || '',
    adminUid,
    subscriptionPlanId: input.subscriptionPlanId || '',
    subscriptionPlanName: input.subscriptionPlanName || 'Custom',
    subscriptionStatus: input.subscriptionStatus,
    subscriptionStartDate: input.subscriptionStartDate || '',
    subscriptionExpiryDate: input.subscriptionExpiryDate || '',
    accountStatus: input.accountStatus,
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('users').doc(adminUid), {
    uid: adminUid,
    email: adminEmail,
    displayName: input.contactPerson.trim(),
    fullName: input.contactPerson.trim(),
    phone: input.phone.trim(),
    loginId: loginId || '',
    role: 'organization_admin',
    organizationId: orgId,
    organizationName: input.organizationName.trim(),
    designation: 'Organization Administrator',
    department: 'Administration',
    permissions: orgAdminPermissions,
    status: input.accountStatus,
    accountStatus: input.accountStatus,
    emailVerified: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('invitedAccounts').doc(adminEmail), {
    email: adminEmail,
    displayName: input.contactPerson.trim(),
    phone: input.phone.trim(),
    loginId: loginId || '',
    role: 'organization_admin',
    organizationId: orgId,
    organizationName: input.organizationName.trim(),
    designation: 'Organization Administrator',
    department: 'Administration',
    permissions: orgAdminPermissions,
    status: input.accountStatus,
    invitedBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (loginId) {
    batch.set(adminDb.collection('loginDirectory').doc(loginId), {
      loginId,
      email: adminEmail,
      uid: adminUid,
      role: 'organization_admin',
      organizationId: orgId,
      accountStatus: input.accountStatus,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: orgId,
    action: 'ORGANIZATION_CREATED',
    targetCollection: 'organizations',
    targetId: orgId,
    targetUserId: adminUid,
    summary: `Provisioned ${input.organizationType} "${input.organizationName}" with admin ${adminEmail}`,
  });

  return {
    success: true,
    organizationId: orgId,
    adminUid,
    passwordSetupLinkGenerated: Boolean(resetLink),
  };
});

// -----------------------------------------------------------------------------
// 4. createOrganizationStaff
// -----------------------------------------------------------------------------
const createOrgStaffSchema = z.object({
  organizationId: z.string().min(1).max(128),
  employeeName: z.string().min(2).max(120),
  employeeId: z.string().min(1).max(60),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional(),
  designation: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  loginId: z.string().max(80).optional(),
  assignedRole: z.string().min(1).max(100),
  permissions: z.array(z.string().max(80)).max(40),
  accountStatus: z.enum(['pending', 'active', 'inactive', 'suspended', 'disabled']).default('active'),
});

export const createOrganizationStaff = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);

  const parsed = createOrgStaffSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message || 'Invalid staff payload.');
  }

  const input = parsed.data;
  const isGlobal = actor.role === 'super_admin';
  const isTenantAdmin =
    actor.role === 'organization_admin' && actor.organizationId === input.organizationId;
  const isPermittedStaff =
    actor.role === 'organization_staff' &&
    actor.organizationId === input.organizationId &&
    hasBackendPermission(actor, 'organization.staff.create');

  if (!isGlobal && !isTenantAdmin && !isPermittedStaff) {
    throw new HttpsError(
      'permission-denied',
      'You are not authorized to create staff inside this organization.'
    );
  }

  const orgSnap = await adminDb.collection('organizations').doc(input.organizationId).get();
  if (!orgSnap.exists) {
    throw new HttpsError('not-found', 'Target organization does not exist.');
  }
  const orgData = orgSnap.data()!;
  if (orgData.accountStatus !== 'active' && !isGlobal) {
    throw new HttpsError('failed-precondition', 'Organization account is not active.');
  }

  const emailLower = input.email.trim().toLowerCase();
  const loginId = normalizeLoginId(input.loginId);

  if (loginId) {
    const existingLogin = await adminDb.collection('loginDirectory').doc(loginId).get();
    if (existingLogin.exists) {
      throw new HttpsError('already-exists', `Login ID "${loginId}" is already in use.`);
    }
  }

  let staffUid = '';
  const existingAuth = await adminAuth.getUserByEmail(emailLower).catch(() => null);
  if (existingAuth) {
    staffUid = existingAuth.uid;
  } else {
    const created = await adminAuth.createUser({
      email: emailLower,
      password: generateTempPassword(),
      displayName: input.employeeName.trim(),
      disabled: input.accountStatus !== 'active' && input.accountStatus !== 'pending',
    });
    staffUid = created.uid;
  }

  await adminAuth.setCustomUserClaims(staffUid, {
    role: 'organization_staff',
    organizationId: input.organizationId,
  });
  const resetLink = await adminAuth.generatePasswordResetLink(emailLower).catch(() => null);

  const staffRef = adminDb.collection('organizationStaff').doc();
  const batch = adminDb.batch();

  batch.set(staffRef, {
    id: staffRef.id,
    uid: staffUid,
    organizationId: input.organizationId,
    employeeId: input.employeeId.trim(),
    name: input.employeeName.trim(),
    email: emailLower,
    phone: input.phone?.trim() || '',
    loginId: loginId || '',
    designation: input.designation.trim(),
    department: input.department.trim(),
    role: input.assignedRole.trim(),
    permissions: input.permissions,
    status: input.accountStatus,
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('users').doc(staffUid), {
    uid: staffUid,
    email: emailLower,
    displayName: input.employeeName.trim(),
    fullName: input.employeeName.trim(),
    phone: input.phone?.trim() || '',
    loginId: loginId || '',
    employeeId: input.employeeId.trim(),
    role: 'organization_staff',
    organizationId: input.organizationId,
    organizationName: String(orgData.name || ''),
    designation: input.designation.trim(),
    department: input.department.trim(),
    permissions: input.permissions,
    status: input.accountStatus,
    accountStatus: input.accountStatus,
    emailVerified: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('invitedAccounts').doc(emailLower), {
    email: emailLower,
    displayName: input.employeeName.trim(),
    phone: input.phone?.trim() || '',
    loginId: loginId || '',
    employeeId: input.employeeId.trim(),
    role: 'organization_staff',
    organizationId: input.organizationId,
    organizationName: String(orgData.name || ''),
    designation: input.designation.trim(),
    department: input.department.trim(),
    permissions: input.permissions,
    status: input.accountStatus,
    invitedBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (loginId) {
    batch.set(adminDb.collection('loginDirectory').doc(loginId), {
      loginId,
      email: emailLower,
      uid: staffUid,
      role: 'organization_staff',
      organizationId: input.organizationId,
      accountStatus: input.accountStatus,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: input.organizationId,
    action: 'USER_CREATED_ORG_STAFF',
    targetCollection: 'organizationStaff',
    targetId: staffRef.id,
    targetUserId: staffUid,
    summary: `Created organization staff "${input.employeeName}" (${input.employeeId})`,
  });

  return {
    success: true,
    staffId: staffRef.id,
    uid: staffUid,
    passwordSetupLinkGenerated: Boolean(resetLink),
  };
});

// -----------------------------------------------------------------------------
// 5. updateUserAccount
// -----------------------------------------------------------------------------
const updateUserAccountSchema = z.object({
  targetUid: z.string().min(1).max(128),
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional(),
  designation: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  accountStatus: z.enum(['pending', 'active', 'inactive', 'suspended', 'disabled']).optional(),
});

export const updateUserAccount = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);
  const parsed = updateUserAccountSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid account update payload.');
  }

  const { targetUid, ...fields } = parsed.data;
  const targetSnap = await adminDb.collection('users').doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target user profile does not exist.');
  }
  const targetData = targetSnap.data()!;

  if (targetData.role === 'super_admin' && actor.uid !== targetUid) {
    throw new HttpsError('permission-denied', 'Super Admin account is protected against external changes.');
  }

  const allowed =
    actor.role === 'super_admin' ||
    (actor.role === 'organization_admin' &&
      targetData.role === 'organization_staff' &&
      targetData.organizationId === actor.organizationId);

  if (!allowed) {
    throw new HttpsError('permission-denied', 'You cannot modify this user account.');
  }

  const updatePayload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (fields.fullName) {
    updatePayload.displayName = fields.fullName.trim();
    updatePayload.fullName = fields.fullName.trim();
  }
  if (fields.phone !== undefined) updatePayload.phone = fields.phone.trim();
  if (fields.designation !== undefined) updatePayload.designation = fields.designation.trim();
  if (fields.department !== undefined) updatePayload.department = fields.department.trim();
  if (fields.accountStatus && targetData.role !== 'super_admin') {
    updatePayload.status = fields.accountStatus;
    updatePayload.accountStatus = fields.accountStatus;
    await adminAuth.updateUser(targetUid, {
      disabled: fields.accountStatus === 'disabled' || fields.accountStatus === 'suspended' || fields.accountStatus === 'inactive',
    });
  }

  await adminDb.collection('users').doc(targetUid).update(updatePayload);

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: targetData.organizationId,
    action: 'USER_UPDATED',
    targetCollection: 'users',
    targetId: targetUid,
    targetUserId: targetUid,
    summary: `Updated account profile for ${targetData.email}`,
  });

  return { success: true };
});

// -----------------------------------------------------------------------------
// 6 & 7. deactivateUser & reactivateUser
// -----------------------------------------------------------------------------
const statusToggleSchema = z.object({
  targetUid: z.string().min(1).max(128),
  status: z.enum(['inactive', 'suspended', 'disabled']).optional(),
  reason: z.string().max(240).optional(),
});

async function setTargetUserStatus(
  callerUid: string | undefined,
  targetUid: string,
  nextStatus: AccountStatus,
  actionName: string,
  reason?: string
) {
  const actor = await requireActiveActor(callerUid);
  const targetSnap = await adminDb.collection('users').doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'User record not found.');
  }
  const target = targetSnap.data()!;

  if (target.role === 'super_admin') {
    throw new HttpsError('permission-denied', 'The unique Super Admin account cannot be deactivated.');
  }
  if (actor.uid === targetUid) {
    throw new HttpsError('permission-denied', 'Administrators cannot deactivate their own active session.');
  }

  const authorized =
    actor.role === 'super_admin' ||
    (actor.role === 'organization_admin' &&
      target.role === 'organization_staff' &&
      target.organizationId === actor.organizationId);

  if (!authorized) {
    throw new HttpsError('permission-denied', 'Insufficient privileges to change this user status.');
  }

  const shouldDisableAuth = nextStatus !== 'active';
  await adminAuth.updateUser(targetUid, { disabled: shouldDisableAuth });
  if (shouldDisableAuth) {
    await adminAuth.revokeRefreshTokens(targetUid);
  }

  await adminDb.collection('users').doc(targetUid).update({
    status: nextStatus,
    accountStatus: nextStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (target.email) {
    const inviteRef = adminDb.collection('invitedAccounts').doc(String(target.email).toLowerCase());
    const inviteSnap = await inviteRef.get();
    if (inviteSnap.exists) {
      await inviteRef.update({ status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
    }
  }

  if (target.loginId) {
    const loginRef = adminDb.collection('loginDirectory').doc(String(target.loginId).toLowerCase());
    const loginSnap = await loginRef.get();
    if (loginSnap.exists) {
      await loginRef.update({ accountStatus: nextStatus, updatedAt: FieldValue.serverTimestamp() });
    }
  }

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: target.organizationId,
    action: actionName,
    targetCollection: 'users',
    targetId: targetUid,
    targetUserId: targetUid,
    summary: `Changed status of ${target.email} to ${nextStatus}${reason ? ` (${reason})` : ''}`,
  });

  return { success: true, status: nextStatus };
}

export const deactivateUser = onCall(callableOptions, async (request) => {
  const parsed = statusToggleSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid deactivateUser payload.');
  }
  return setTargetUserStatus(
    request.auth?.uid,
    parsed.data.targetUid,
    parsed.data.status || 'inactive',
    'USER_DEACTIVATED',
    parsed.data.reason
  );
});

export const reactivateUser = onCall(callableOptions, async (request) => {
  const parsed = z.object({ targetUid: z.string().min(1).max(128) }).safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid reactivateUser payload.');
  }
  return setTargetUserStatus(request.auth?.uid, parsed.data.targetUid, 'active', 'USER_REACTIVATED');
});

// -----------------------------------------------------------------------------
// 8. updateStaffPermissions
// -----------------------------------------------------------------------------
const updatePermissionsSchema = z.object({
  targetUid: z.string().min(1).max(128),
  permissions: z.array(z.string().max(80)).max(40),
});

export const updateStaffPermissions = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);
  const parsed = updatePermissionsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid permissions payload.');
  }

  const { targetUid, permissions } = parsed.data;
  if (actor.uid === targetUid) {
    throw new HttpsError('permission-denied', 'Users cannot modify their own permissions.');
  }

  const targetSnap = await adminDb.collection('users').doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target staff user not found.');
  }
  const target = targetSnap.data()!;

  if (target.role === 'super_admin') {
    throw new HttpsError('permission-denied', 'Super Admin permissions are immutable.');
  }

  const isAllowed =
    (actor.role === 'super_admin' && target.role === 'super_admin_staff') ||
    (actor.role === 'organization_admin' &&
      target.role === 'organization_staff' &&
      target.organizationId === actor.organizationId);

  if (!isAllowed) {
    throw new HttpsError('permission-denied', 'Insufficient authority to update staff permissions.');
  }

  await adminDb.collection('users').doc(targetUid).update({
    permissions,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (target.email) {
    const inviteRef = adminDb.collection('invitedAccounts').doc(String(target.email).toLowerCase());
    if ((await inviteRef.get()).exists) {
      await inviteRef.update({ permissions, updatedAt: FieldValue.serverTimestamp() });
    }
  }

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: target.organizationId,
    action: 'PERMISSIONS_UPDATED',
    targetCollection: 'users',
    targetId: targetUid,
    targetUserId: targetUid,
    summary: `Updated ${permissions.length} module permissions for ${target.email}`,
  });

  return { success: true, permissionsCount: permissions.length };
});

// -----------------------------------------------------------------------------
// 9. resetOrInviteUserPassword
// -----------------------------------------------------------------------------
export const resetOrInviteUserPassword = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);
  const parsed = z.object({ email: z.string().email().max(160) }).safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Valid email is required.');
  }

  const emailLower = parsed.data.email.trim().toLowerCase();
  if (actor.role !== 'super_admin' && actor.role !== 'organization_admin') {
    throw new HttpsError('permission-denied', 'Only administrators can issue password setup links.');
  }

  const userRecord = await adminAuth.getUserByEmail(emailLower).catch(() => null);
  if (!userRecord) {
    throw new HttpsError('not-found', 'No Firebase Auth account exists for this email yet.');
  }

  const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
  if (actor.role === 'organization_admin') {
    if (!userDoc.exists || userDoc.data()?.organizationId !== actor.organizationId) {
      throw new HttpsError('permission-denied', 'Cannot issue reset links outside your organization.');
    }
  }

  const link = await adminAuth.generatePasswordResetLink(emailLower);

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: actor.organizationId,
    action: 'PASSWORD_SETUP_INVITE_ISSUED',
    targetCollection: 'users',
    targetId: userRecord.uid,
    targetUserId: userRecord.uid,
    summary: `Generated password setup link for ${emailLower}`,
  });

  return { success: true, passwordSetupLink: link };
});

// -----------------------------------------------------------------------------
// 10. resolveLoginId (Strict Server-Side Lookup; No Public Directory Exposed)
// -----------------------------------------------------------------------------
export const resolveLoginId = onCall(callableOptions, async (request) => {
  const parsed = z
    .object({ identifier: z.string().min(2).max(160) })
    .safeParse(request.data);

  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Valid email or Login ID is required.');
  }

  const raw = parsed.data.identifier.trim().toLowerCase();
  if (raw.includes('@')) {
    return { email: raw };
  }

  const normalized = normalizeLoginId(raw);
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'Invalid Login ID format.');
  }

  const snap = await adminDb.collection('loginDirectory').doc(normalized).get();
  if (!snap.exists) {
    // Return uniform generic error to avoid user enumeration
    throw new HttpsError('not-found', 'Invalid credentials or unrecognized Login ID.');
  }

  const entry = snap.data()!;
  return {
    email: String(entry.email).toLowerCase(),
  };
});

// -----------------------------------------------------------------------------
// 11. writeAuditLog (Trusted Server Audit Trail)
// -----------------------------------------------------------------------------
const auditSchema = z.object({
  action: z.string().min(2).max(80),
  targetCollection: z.string().min(2).max(80),
  targetId: z.string().min(1).max(128),
  targetUserId: z.string().max(128).optional(),
  organizationId: z.string().max(128).optional(),
  summary: z.string().min(2).max(300),
  metadata: z.record(z.unknown()).optional(),
});

export const writeAuditLog = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);
  const parsed = auditSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid audit log payload.');
  }

  const data = parsed.data;
  const scopedOrgId =
    actor.role === 'super_admin' || actor.role === 'super_admin_staff'
      ? data.organizationId
      : actor.organizationId;

  await recordServerAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    organizationId: scopedOrgId,
    action: data.action,
    targetCollection: data.targetCollection,
    targetId: data.targetId,
    targetUserId: data.targetUserId,
    summary: data.summary,
    metadata: data.metadata,
  });

  return { success: true };
});
