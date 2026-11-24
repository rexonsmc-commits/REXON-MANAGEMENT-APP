# REXON MANAGEMENT APP — Security Specification (Phase 1 & Phase 2 TDD)

## 1. Core Data Invariants
1. **Unique Super Admin Invariant**: Exactly one Super Admin configuration singleton (`/systemConfig/main` and `/systemConfig/superAdmin`) may exist. Creation requires `request.auth.token.email_verified == true && request.auth.token.email == 'rexon.smc@gmail.com' && incoming().superAdminUid == request.auth.uid && !exists(...)` (or trusted Firebase Admin SDK server-side execution). Updates and deletes via client SDK are permanently denied.
2. **No Self-Assigned Privileged Roles**: Users creating `/users/{uid}` cannot assign `super_admin` unless they match `/systemConfig/main` / `/systemConfig/superAdmin` or the verified bootstrapped admin email, and cannot assign `super_admin_staff`, `organization_admin`, or `organization_staff` unless matched verbatim against a trusted `/invitedAccounts/{verifiedEmail}` record created by an authorized administrator (or created server-side by Cloud Functions).
3. **Strict Multi-Tenant Isolation**: Every tenant document (`organizationStaff`, `roles`, `subscriptions`, `payments`, `towers`, `wings`, `flats`) requires a non-empty `organizationId` matching an existing `/organizations/{organizationId}`. Non-global users may only read/write documents where `organizationId` equals their own active `/users/{uid}.organizationId`.
4. **Account & Organization Status Enforcement**: Accounts with `status` or `accountStatus` in `['pending', 'inactive', 'suspended', 'disabled']` are blocked from all operational reads and writes. Suspended organizations cannot perform operational tenant writes.
5. **No Public User or Login ID Directory**: Both `/users` and `/loginDirectory` deny public/unauthenticated reads. Login ID resolution executes exclusively through the `resolveLoginId` Cloud Function using the Firebase Admin SDK.
6. **Immutable Ownership & Temporal Integrity**: `createdAt`, `createdBy`, `uid`, `role`, and `organizationId` cannot be altered by non-admin users or self-elevated. Timestamps `createdAt` and `updatedAt` are validated against `request.time`.
7. **Super Admin Exclusive Plan & Payment Authority**: Only Super Admin (or permitted Super Admin Staff for allowed sub-scopes) may create/edit/delete `subscriptionPlans`, verify `payments`, or activate `subscriptions`.
8. **Append-Only Audit Logs**: `auditLogs` allows authenticated creation where `actorUid == request.auth.uid`, and permanently denies `update` and `delete`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Fail with PERMISSION_DENIED)
1. **Unauthenticated Organization Read**: Unauthenticated client calls `getDocs(collection(db, 'organizations'))`. -> DENIED.
2. **Public Login ID Enumeration**: Unauthenticated client calls `getDoc(doc(db, 'loginDirectory', 'sa_ops_01'))` or `getDocs(collection(db, 'loginDirectory'))`. -> DENIED.
3. **Privilege Escalation on Profile Creation**: Verified non-admin user writes `/users/{uid}` with `{ role: 'super_admin', status: 'active' }`. -> DENIED.
4. **Second Super Admin Claim**: Verified non-bootstrapped user attempts `setDoc(doc(db, 'systemConfig', 'main'), { superAdminUid: uid, initialized: true })`. -> DENIED.
5. **Cross-Tenant Tower Read**: Organization A Admin calls `getDoc(doc(db, 'towers', 'tower_org_B'))`. -> DENIED.
6. **Cross-Tenant List Query Bypass**: Organization A Staff executes `getDocs(collection(db, 'flats'))` without filtering to `organizationId == 'org_A'`. -> DENIED.
7. **Staff Self-Elevation**: Organization Staff updates `/users/{uid}` to add `'organization.staff.create'` to `permissions` or change `role` to `'organization_admin'`. -> DENIED.
8. **Suspended / Disabled Account Write**: Suspended Organization Staff attempts `setDoc(doc(db, 'towers', 't_new'), ...)`. -> DENIED.
9. **Shadow Field Injection on Tower Create**: Organization Admin creates `/towers/t1` with `{ ...validFields, isAdminOverride: true }`. -> DENIED (`hasOnly` check fails).
10. **Resource Exhaustion / ID Poisoning**: Authenticated user attempts `setDoc(doc(db, 'towers', 'a'.repeat(500)), ...)`. -> DENIED (`isValidId` fails).
11. **Subscription Self-Activation by Tenant**: Organization Admin updates `/organizations/{orgId}` setting `subscriptionStatus: 'Active'`. -> DENIED.
12. **Audit Log Tampering**: Malicious actor attempts `deleteDoc(doc(db, 'auditLogs', 'log_1'))` or `updateDoc` to erase traces. -> DENIED.
