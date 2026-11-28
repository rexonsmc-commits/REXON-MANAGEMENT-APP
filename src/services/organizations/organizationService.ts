import {
  collection,
  deleteDoc,
  deleteField,
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
import { Flat, Organization, Tower, UserProfile, Wing } from '../../types';
import { generateSafeId } from '../auth/authService';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  callCreateOrganization,
  isCallableNotDeployedError,
  isCloudFunctionsEnabled,
} from '../functions/cloudFunctions';
import { createAuditLog } from '../subscriptions/subscriptionService';

export async function listOrganizations(): Promise<Organization[]> {
  try {
    const snap = await getDocs(collection(db, 'organizations'));
    return snap.docs.map((d) => d.data() as Organization);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'organizations');
  }
}

export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId));
    return snap.exists() ? (snap.data() as Organization) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `organizations/${orgId}`);
  }
}

export async function createOrganization(
  input: Omit<Organization, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<Organization> {
  const adminEmail = input.adminLoginEmail.trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX);
  const adminLoginId = input.adminLoginId
    ? input.adminLoginId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 80)
    : undefined;

  // Prefer server-side Cloud Function when enabled/deployed
  if (isCloudFunctionsEnabled()) {
    try {
      const fnResult = await callCreateOrganization({
        organizationName: input.name,
        organizationType: input.type,
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone,
        address: input.address,
        adminLoginEmail: adminEmail,
        loginId: adminLoginId,
        subscriptionPlanId: input.subscriptionPlanId,
        subscriptionPlanName: input.subscriptionPlanName,
        subscriptionStatus: input.subscriptionStatus,
        subscriptionStartDate: input.subscriptionStartDate,
        subscriptionExpiryDate: input.subscriptionExpiryDate,
        accountStatus: input.accountStatus,
      });

      const createdOrg = await getOrganizationById(fnResult.organizationId);
      if (createdOrg) return createdOrg;
      return {
        ...(input as Organization),
        id: fnResult.organizationId,
        organizationId: fnResult.organizationId,
        adminUid: fnResult.adminUid,
        createdBy: actor.uid,
      };
    } catch (fnErr) {
      if (!isCallableNotDeployedError(fnErr)) {
        throw fnErr;
      }
    }
  }

  const id = generateSafeId('org');
  const payload: Record<string, unknown> = {
    id,
    organizationId: id,
    name: input.name.trim().slice(0, FIELD_LIMITS.ORG_NAME_MAX),
    type: input.type,
    contactPerson: input.contactPerson.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    email: input.email.trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX),
    phone: input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX),
    address: input.address.trim().slice(0, FIELD_LIMITS.ADDRESS_MAX),
    adminLoginEmail: adminEmail,
    subscriptionStatus: input.subscriptionStatus,
    accountStatus: input.accountStatus,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (adminLoginId) payload.adminLoginId = adminLoginId;
  if (input.subscriptionPlanId) payload.subscriptionPlanId = input.subscriptionPlanId;
  if (input.subscriptionPlanName) payload.subscriptionPlanName = input.subscriptionPlanName;
  if (input.subscriptionStartDate) payload.subscriptionStartDate = input.subscriptionStartDate;
  if (input.subscriptionExpiryDate) payload.subscriptionExpiryDate = input.subscriptionExpiryDate;

  try {
    await setDoc(doc(db, 'organizations', id), payload);

    const invitePayload: Record<string, unknown> = {
      email: adminEmail,
      displayName: input.contactPerson.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      phone: input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX),
      role: 'organization_admin',
      organizationId: id,
      organizationName: input.name.trim().slice(0, FIELD_LIMITS.ORG_NAME_MAX),
      designation: 'Organization Administrator',
      department: 'Administration',
      permissions: [
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
      ],
      status: input.accountStatus,
      invitedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (adminLoginId) invitePayload.loginId = adminLoginId;

    await setDoc(doc(db, 'invitedAccounts', adminEmail), invitePayload);

    if (adminLoginId && adminLoginId.length >= 2) {
      await setDoc(doc(db, 'loginDirectory', adminLoginId), {
        loginId: adminLoginId,
        email: adminEmail,
        role: 'organization_admin',
        organizationId: id,
        accountStatus: input.accountStatus,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await createAuditLog(actor, {
      organizationId: id,
      action: 'CREATE_ORGANIZATION',
      targetCollection: 'organizations',
      targetId: id,
      summary: `Created ${input.type} organization "${input.name}" with admin ${adminEmail}`,
    });

    return { ...(payload as unknown as Organization), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `organizations/${id}`);
  }
}

export async function updateOrganization(
  orgId: string,
  updates: Partial<Organization>,
  actor: UserProfile
): Promise<void> {
  try {
    const existingSnap = await getDoc(doc(db, 'organizations', orgId));
    if (!existingSnap.exists()) {
      throw new Error('Organization not found');
    }
    const current = existingSnap.data() as Organization;

    const payload: Record<string, unknown> = {
      id: current.id,
      organizationId: current.id,
      name: (updates.name ?? current.name).trim().slice(0, FIELD_LIMITS.ORG_NAME_MAX),
      type: updates.type ?? current.type,
      contactPerson: (updates.contactPerson ?? current.contactPerson)
        .trim()
        .slice(0, FIELD_LIMITS.NAME_MAX),
      email: (updates.email ?? current.email).trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX),
      phone: (updates.phone ?? current.phone).trim().slice(0, FIELD_LIMITS.PHONE_MAX),
      address: (updates.address ?? current.address).trim().slice(0, FIELD_LIMITS.ADDRESS_MAX),
      adminLoginEmail: (updates.adminLoginEmail ?? current.adminLoginEmail)
        .trim()
        .toLowerCase()
        .slice(0, FIELD_LIMITS.EMAIL_MAX),
      subscriptionStatus: updates.subscriptionStatus ?? current.subscriptionStatus,
      accountStatus: updates.accountStatus ?? current.accountStatus,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedAt: serverTimestamp(),
    };

    const planId = updates.subscriptionPlanId ?? current.subscriptionPlanId;
    const planName = updates.subscriptionPlanName ?? current.subscriptionPlanName;
    const startDate = updates.subscriptionStartDate ?? current.subscriptionStartDate;
    const expiryDate = updates.subscriptionExpiryDate ?? current.subscriptionExpiryDate;
    const adminLoginId = updates.adminLoginId ?? current.adminLoginId;
    const adminUid = updates.adminUid ?? current.adminUid;
    if (planId) payload.subscriptionPlanId = planId;
    if (planName) payload.subscriptionPlanName = planName;
    if (startDate) payload.subscriptionStartDate = startDate;
    if (expiryDate) payload.subscriptionExpiryDate = expiryDate;
    if (adminLoginId) payload.adminLoginId = adminLoginId;
    if (adminUid) payload.adminUid = adminUid;
    if (typeof (updates.isHidden ?? current.isHidden) === 'boolean') {
      payload.isHidden = updates.isHidden ?? current.isHidden;
    }
    if (current.hiddenAt && payload.isHidden) {
      payload.hiddenAt = current.hiddenAt;
    }

    await updateDoc(doc(db, 'organizations', orgId), payload);

    const adminEmailLower = String(payload.adminLoginEmail).toLowerCase();
    try {
      const inviteSnap = await getDoc(doc(db, 'invitedAccounts', adminEmailLower));
      if (inviteSnap.exists()) {
        await updateDoc(doc(db, 'invitedAccounts', adminEmailLower), {
          displayName: payload.contactPerson,
          organizationName: payload.name,
          status: payload.accountStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Staff without manage_staff may not update invitedAccounts; org update still succeeds
    }

    await createAuditLog(actor, {
      organizationId: orgId,
      action: 'UPDATE_ORGANIZATION',
      targetCollection: 'organizations',
      targetId: orgId,
      summary: `Updated company/society "${String(payload.name)}" (${String(payload.accountStatus)})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}`);
  }
}

export async function updateOrganizationProfileByTenant(
  orgId: string,
  updates: Pick<Organization, 'name' | 'contactPerson' | 'email' | 'phone' | 'address'>,
  actor: UserProfile
): Promise<void> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      name: updates.name.trim().slice(0, FIELD_LIMITS.ORG_NAME_MAX),
      contactPerson: updates.contactPerson.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      email: updates.email.trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX),
      phone: updates.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX),
      address: updates.address.trim().slice(0, FIELD_LIMITS.ADDRESS_MAX),
      updatedAt: serverTimestamp(),
    });
    await createAuditLog(actor, {
      organizationId: orgId,
      action: 'UPDATE_ORG_PROFILE',
      targetCollection: 'organizations',
      targetId: orgId,
      summary: `Updated organization contact profile for "${updates.name}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}`);
  }
}

export async function setOrganizationHiddenState(
  orgId: string,
  orgName: string,
  isHidden: boolean,
  actor: UserProfile
): Promise<void> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      isHidden,
      hiddenAt: isHidden ? serverTimestamp() : deleteField(),
      updatedAt: serverTimestamp(),
    });
    await createAuditLog(actor, {
      organizationId: orgId,
      action: isHidden ? 'HIDE_ORGANIZATION' : 'UNHIDE_ORGANIZATION',
      targetCollection: 'organizations',
      targetId: orgId,
      summary: `${isHidden ? 'Hidden' : 'Unhidden'} company/society "${orgName}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}`);
  }
}

export async function deleteOrganization(
  orgId: string,
  orgName: string,
  actor: UserProfile
): Promise<void> {
  try {
    const orgSnap = await getDoc(doc(db, 'organizations', orgId)).catch(() => null);
    const orgData = orgSnap?.exists() ? (orgSnap.data() as Organization) : null;

    // Collect known login IDs & emails to revoke login access cleanly
    const loginIdsToDelete = new Set<string>();
    if (orgData?.adminLoginId) loginIdsToDelete.add(orgData.adminLoginId.toLowerCase());

    const staffSnap = await getDocs(
      query(collection(db, 'organizationStaff'), where('organizationId', '==', orgId))
    ).catch(() => null);

    if (staffSnap) {
      for (const d of staffSnap.docs) {
        const st = d.data() as { loginId?: string };
        if (st.loginId) loginIdsToDelete.add(st.loginId.toLowerCase());
        await deleteDoc(d.ref).catch(() => undefined);
      }
    }

    const scopedCollections = ['towers', 'wings', 'flats', 'roles', 'invitedAccounts'];
    for (const colName of scopedCollections) {
      const snap = await getDocs(
        query(collection(db, colName), where('organizationId', '==', orgId))
      ).catch(() => null);
      if (snap) {
        for (const d of snap.docs) {
          await deleteDoc(d.ref).catch(() => undefined);
        }
      }
    }

    const customPermSnap = await getDocs(
      query(
        collection(db, 'customPermissions'),
        where('scope', '==', 'organization'),
        where('organizationId', '==', orgId)
      )
    ).catch(() => null);
    if (customPermSnap) {
      for (const d of customPermSnap.docs) {
        await deleteDoc(d.ref).catch(() => undefined);
      }
    }

    const usersSnap = await getDocs(
      query(collection(db, 'users'), where('organizationId', '==', orgId))
    ).catch(() => null);
    if (usersSnap) {
      for (const d of usersSnap.docs) {
        const u = d.data() as { role?: string };
        if (u.role !== 'super_admin') {
          await deleteDoc(d.ref).catch(() => undefined);
        }
      }
    }

    for (const loginKey of loginIdsToDelete) {
      await deleteDoc(doc(db, 'loginDirectory', loginKey)).catch(() => undefined);
    }

    if (orgData?.adminLoginEmail) {
      await deleteDoc(doc(db, 'invitedAccounts', orgData.adminLoginEmail.toLowerCase())).catch(
        () => undefined
      );
    }

    await deleteDoc(doc(db, 'organizations', orgId));
    await createAuditLog(actor, {
      organizationId: orgId,
      action: 'DELETE_ORGANIZATION',
      targetCollection: 'organizations',
      targetId: orgId,
      summary: `Deleted company/society "${orgName}" and revoked tenant access`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}`);
  }
}

// =========================================================================
// TOWERS, WINGS & FLATS (Tenant-Isolated Property Management)
// =========================================================================

export async function listTowers(organizationId: string): Promise<Tower[]> {
  try {
    const q = query(collection(db, 'towers'), where('organizationId', '==', organizationId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Tower);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'towers');
  }
}

export async function createTower(
  input: Omit<Tower, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<Tower> {
  const id = generateSafeId('tower');
  const payload: Record<string, unknown> = {
    id,
    organizationId: input.organizationId,
    name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    towerNumber: input.towerNumber.trim().slice(0, 40),
    status: input.status,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.description) {
    payload.description = input.description.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX);
  }
  try {
    await setDoc(doc(db, 'towers', id), payload);
    await createAuditLog(actor, {
      organizationId: input.organizationId,
      action: 'CREATE_TOWER',
      targetCollection: 'towers',
      targetId: id,
      summary: `Created tower "${input.name}" (${input.towerNumber})`,
    });
    return { ...(payload as unknown as Tower), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `towers/${id}`);
  }
}

export async function updateTower(
  towerId: string,
  updates: Partial<Tower>,
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'towers', towerId));
    if (!snap.exists()) throw new Error('Tower not found');
    const cur = snap.data() as Tower;
    const payload: Record<string, unknown> = {
      id: cur.id,
      organizationId: cur.organizationId,
      name: (updates.name ?? cur.name).trim().slice(0, FIELD_LIMITS.NAME_MAX),
      towerNumber: (updates.towerNumber ?? cur.towerNumber).trim().slice(0, 40),
      status: updates.status ?? cur.status,
      createdBy: cur.createdBy,
      createdAt: cur.createdAt,
      updatedAt: serverTimestamp(),
    };
    const desc = updates.description ?? cur.description;
    if (desc !== undefined && desc !== '') {
      payload.description = desc.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX);
    }
    await updateDoc(doc(db, 'towers', towerId), payload);
    await createAuditLog(actor, {
      organizationId: cur.organizationId,
      action: 'UPDATE_TOWER',
      targetCollection: 'towers',
      targetId: towerId,
      summary: `Updated tower "${String(payload.name)}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `towers/${towerId}`);
  }
}

export async function deleteTower(towerId: string, organizationId: string, actor: UserProfile): Promise<void> {
  try {
    await deleteDoc(doc(db, 'towers', towerId));
    await createAuditLog(actor, {
      organizationId,
      action: 'DELETE_TOWER',
      targetCollection: 'towers',
      targetId: towerId,
      summary: `Deleted tower ${towerId}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `towers/${towerId}`);
  }
}

export async function listWings(organizationId: string): Promise<Wing[]> {
  try {
    const q = query(collection(db, 'wings'), where('organizationId', '==', organizationId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Wing);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'wings');
  }
}

export async function createWing(
  input: Omit<Wing, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<Wing> {
  const id = generateSafeId('wing');
  const payload: Record<string, unknown> = {
    id,
    organizationId: input.organizationId,
    towerId: input.towerId,
    name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    status: input.status,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.towerName) payload.towerName = input.towerName.trim().slice(0, FIELD_LIMITS.NAME_MAX);
  if (input.description) {
    payload.description = input.description.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX);
  }
  try {
    await setDoc(doc(db, 'wings', id), payload);
    await createAuditLog(actor, {
      organizationId: input.organizationId,
      action: 'CREATE_WING',
      targetCollection: 'wings',
      targetId: id,
      summary: `Created wing "${input.name}" in tower ${input.towerName || input.towerId}`,
    });
    return { ...(payload as unknown as Wing), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `wings/${id}`);
  }
}

export async function updateWing(
  wingId: string,
  updates: Partial<Wing>,
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'wings', wingId));
    if (!snap.exists()) throw new Error('Wing not found');
    const cur = snap.data() as Wing;
    const payload: Record<string, unknown> = {
      id: cur.id,
      organizationId: cur.organizationId,
      towerId: updates.towerId ?? cur.towerId,
      name: (updates.name ?? cur.name).trim().slice(0, FIELD_LIMITS.NAME_MAX),
      status: updates.status ?? cur.status,
      createdBy: cur.createdBy,
      createdAt: cur.createdAt,
      updatedAt: serverTimestamp(),
    };
    const tName = updates.towerName ?? cur.towerName;
    if (tName) payload.towerName = tName.trim().slice(0, FIELD_LIMITS.NAME_MAX);
    const desc = updates.description ?? cur.description;
    if (desc) payload.description = desc.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX);

    await updateDoc(doc(db, 'wings', wingId), payload);
    await createAuditLog(actor, {
      organizationId: cur.organizationId,
      action: 'UPDATE_WING',
      targetCollection: 'wings',
      targetId: wingId,
      summary: `Updated wing "${String(payload.name)}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `wings/${wingId}`);
  }
}

export async function deleteWing(wingId: string, organizationId: string, actor: UserProfile): Promise<void> {
  try {
    await deleteDoc(doc(db, 'wings', wingId));
    await createAuditLog(actor, {
      organizationId,
      action: 'DELETE_WING',
      targetCollection: 'wings',
      targetId: wingId,
      summary: `Deleted wing ${wingId}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `wings/${wingId}`);
  }
}

export async function listFlats(organizationId: string): Promise<Flat[]> {
  try {
    const q = query(collection(db, 'flats'), where('organizationId', '==', organizationId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Flat);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'flats');
  }
}

export async function createFlat(
  input: Omit<Flat, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<Flat> {
  const id = generateSafeId('flat');
  const payload: Record<string, unknown> = {
    id,
    organizationId: input.organizationId,
    towerId: input.towerId,
    wingId: input.wingId,
    flatNumber: input.flatNumber.trim().slice(0, 40),
    floorNumber: input.floorNumber.trim().slice(0, 20),
    flatType: input.flatType.trim().slice(0, 40),
    ownerName: input.ownerName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    occupancyType: input.occupancyType,
    status: input.status,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.towerName) payload.towerName = input.towerName.trim().slice(0, FIELD_LIMITS.NAME_MAX);
  if (input.wingName) payload.wingName = input.wingName.trim().slice(0, FIELD_LIMITS.NAME_MAX);
  if (input.ownerContact) payload.ownerContact = input.ownerContact.trim().slice(0, FIELD_LIMITS.PHONE_MAX);
  if (input.ownerEmail) payload.ownerEmail = input.ownerEmail.trim().slice(0, FIELD_LIMITS.EMAIL_MAX);
  if (input.tenantName) payload.tenantName = input.tenantName.trim().slice(0, FIELD_LIMITS.NAME_MAX);
  if (input.tenantContact) payload.tenantContact = input.tenantContact.trim().slice(0, FIELD_LIMITS.PHONE_MAX);

  try {
    await setDoc(doc(db, 'flats', id), payload);
    await createAuditLog(actor, {
      organizationId: input.organizationId,
      action: 'CREATE_FLAT',
      targetCollection: 'flats',
      targetId: id,
      summary: `Created flat ${input.flatNumber} (${input.occupancyType})`,
    });
    return { ...(payload as unknown as Flat), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `flats/${id}`);
  }
}

export async function updateFlat(
  flatId: string,
  updates: Partial<Flat>,
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'flats', flatId));
    if (!snap.exists()) throw new Error('Flat not found');
    const cur = snap.data() as Flat;

    const payload: Record<string, unknown> = {
      id: cur.id,
      organizationId: cur.organizationId,
      towerId: updates.towerId ?? cur.towerId,
      wingId: updates.wingId ?? cur.wingId,
      flatNumber: (updates.flatNumber ?? cur.flatNumber).trim().slice(0, 40),
      floorNumber: (updates.floorNumber ?? cur.floorNumber).trim().slice(0, 20),
      flatType: (updates.flatType ?? cur.flatType).trim().slice(0, 40),
      ownerName: (updates.ownerName ?? cur.ownerName).trim().slice(0, FIELD_LIMITS.NAME_MAX),
      occupancyType: updates.occupancyType ?? cur.occupancyType,
      status: updates.status ?? cur.status,
      createdBy: cur.createdBy,
      createdAt: cur.createdAt,
      updatedAt: serverTimestamp(),
    };

    const optFields: Array<keyof Flat> = [
      'towerName',
      'wingName',
      'ownerContact',
      'ownerEmail',
      'tenantName',
      'tenantContact',
    ];
    for (const key of optFields) {
      const val = updates[key] !== undefined ? updates[key] : cur[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        payload[key] = val.trim();
      }
    }

    await updateDoc(doc(db, 'flats', flatId), payload);
    await createAuditLog(actor, {
      organizationId: cur.organizationId,
      action: 'UPDATE_FLAT',
      targetCollection: 'flats',
      targetId: flatId,
      summary: `Updated flat ${String(payload.flatNumber)}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `flats/${flatId}`);
  }
}

export async function deleteFlat(flatId: string, organizationId: string, actor: UserProfile): Promise<void> {
  try {
    await deleteDoc(doc(db, 'flats', flatId));
    await createAuditLog(actor, {
      organizationId,
      action: 'DELETE_FLAT',
      targetCollection: 'flats',
      targetId: flatId,
      summary: `Deleted flat ${flatId}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `flats/${flatId}`);
  }
}
