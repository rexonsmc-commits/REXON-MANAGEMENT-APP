/**
 * REXON MANAGEMENT APP — Firestore Security Rules Emulator Test Suite
 *
 * Run with Firebase Emulator Suite:
 *   npm install --save-dev @firebase/rules-unit-testing vitest
 *   firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
 */
import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

export async function setupEmulatorRulesTest() {
  testEnv = await initializeTestEnvironment({
    projectId: 'rexon-rules-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

export async function runDirtyDozenSecurityChecks() {
  await setupEmulatorRulesTest();

  try {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'systemConfig', 'main'), {
        superAdminUid: 'sa_uid_1',
        email: 'rexon.smc@gmail.com',
        initialized: true,
        platformName: 'REXON MANAGEMENT APP',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'users', 'sa_uid_1'), {
        uid: 'sa_uid_1',
        email: 'rexon.smc@gmail.com',
        displayName: 'Super Admin',
        role: 'super_admin',
        permissions: ['all'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'organizations', 'org_A'), {
        id: 'org_A',
        name: 'Org A',
        type: 'Company',
        contactPerson: 'Alice',
        email: 'a@orga.com',
        phone: '+1000000000',
        address: 'Site A',
        adminLoginEmail: 'admin@orga.com',
        subscriptionStatus: 'Active',
        accountStatus: 'active',
        createdBy: 'sa_uid_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'organizations', 'org_B'), {
        id: 'org_B',
        name: 'Org B',
        type: 'Factory',
        contactPerson: 'Bob',
        email: 'b@orgb.com',
        phone: '+1000000001',
        address: 'Site B',
        adminLoginEmail: 'admin@orgb.com',
        subscriptionStatus: 'Active',
        accountStatus: 'active',
        createdBy: 'sa_uid_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'users', 'org_a_admin'), {
        uid: 'org_a_admin',
        email: 'admin@orga.com',
        displayName: 'Org A Admin',
        role: 'organization_admin',
        organizationId: 'org_A',
        permissions: ['organization.dashboard.view'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'users', 'org_a_staff_suspended'), {
        uid: 'org_a_staff_suspended',
        email: 'susp@orga.com',
        displayName: 'Suspended Staff',
        role: 'organization_staff',
        organizationId: 'org_A',
        permissions: ['organization.properties.manage'],
        status: 'suspended',
        accountStatus: 'suspended',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'towers', 'tower_org_B'), {
        id: 'tower_org_B',
        organizationId: 'org_B',
        name: 'Tower B1',
        towerNumber: 'B1',
        status: 'active',
        createdBy: 'sa_uid_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, 'loginDirectory', 'org_a_admin'), {
        loginId: 'org_a_admin',
        email: 'admin@orga.com',
        role: 'organization_admin',
        organizationId: 'org_A',
        accountStatus: 'active',
        createdBy: 'sa_uid_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    const orgAAdminDb = testEnv
      .authenticatedContext('org_a_admin', { email: 'admin@orga.com', email_verified: true })
      .firestore();
    const suspendedStaffDb = testEnv
      .authenticatedContext('org_a_staff_suspended', { email: 'susp@orga.com', email_verified: true })
      .firestore();
    const attackerDb = testEnv
      .authenticatedContext('attacker_1', { email: 'attacker@evil.com', email_verified: true })
      .firestore();

    // 1. Unauthenticated org list -> FAIL
    await assertFails(getDocs(collection(anonDb, 'organizations')));
    // 2. Public loginDirectory lookup -> FAIL
    await assertFails(getDoc(doc(anonDb, 'loginDirectory', 'org_a_admin')));
    // 3. Privilege escalation on profile create -> FAIL
    await assertFails(
      setDoc(doc(attackerDb, 'users', 'attacker_1'), {
        uid: 'attacker_1',
        email: 'attacker@evil.com',
        displayName: 'Attacker',
        role: 'super_admin',
        permissions: ['all'],
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 4. Second Super Admin singleton creation -> FAIL
    await assertFails(
      setDoc(doc(attackerDb, 'systemConfig', 'main'), {
        superAdminUid: 'attacker_1',
        initialized: true,
        platformName: 'REXON',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 5. Cross-tenant tower read -> FAIL
    await assertFails(getDoc(doc(orgAAdminDb, 'towers', 'tower_org_B')));
    // 6. Cross-tenant unfiltered list -> FAIL
    await assertFails(getDocs(collection(orgAAdminDb, 'flats')));
    // 7. Staff/Admin role self-escalation -> FAIL
    await assertFails(
      updateDoc(doc(orgAAdminDb, 'users', 'org_a_admin'), {
        role: 'super_admin',
        updatedAt: serverTimestamp(),
      })
    );
    // 8. Suspended user write -> FAIL
    await assertFails(
      setDoc(doc(suspendedStaffDb, 'towers', 't_susp_1'), {
        id: 't_susp_1',
        organizationId: 'org_A',
        name: 'Illegal Tower',
        towerNumber: 'T99',
        status: 'active',
        createdBy: 'org_a_staff_suspended',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 9. Valid tenant tower write -> SUCCEED
    await assertSucceeds(
      setDoc(doc(orgAAdminDb, 'towers', 't_valid_1'), {
        id: 't_valid_1',
        organizationId: 'org_A',
        name: 'Valid Tower A',
        towerNumber: 'A1',
        status: 'active',
        createdBy: 'org_a_admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 10. Audit log deletion -> FAIL
    await assertFails(deleteDoc(doc(orgAAdminDb, 'auditLogs', 'any_log')));
  } finally {
    await testEnv.cleanup();
  }
}
