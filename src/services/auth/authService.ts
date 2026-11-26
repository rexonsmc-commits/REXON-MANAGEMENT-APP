import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  BOOTSTRAPPED_SUPER_ADMIN_UID,
} from '../../config/permissions';
import { InvitedAccount, SystemConfigMain, UserProfile } from '../../types';
import { auth, db, firebaseConfig, handleFirestoreError, OperationType } from '../firebase/config';
import {
  callInitializeSuperAdmin,
  callResolveLoginId,
  callWriteAuditLog,
  isCallableNotDeployedError,
  isCloudFunctionsEnabled,
} from '../functions/cloudFunctions';

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function configureSessionPersistence(rememberSession: boolean): Promise<void> {
  await setPersistence(auth, rememberSession ? browserLocalPersistence : browserSessionPersistence);
}

export async function resolveIdentifierToEmail(identifier: string): Promise<string> {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  try {
    const result = await callResolveLoginId(trimmed);
    return result.email.trim().toLowerCase();
  } catch (err) {
    if (isCallableNotDeployedError(err)) {
      throw new Error(
        'Login ID resolution requires deployed Firebase Cloud Functions. Sign in using your registered email address or deploy Cloud Functions.'
      );
    }
    throw err;
  }
}

export async function loginWithGoogle(rememberSession = true): Promise<User> {
  await configureSessionPersistence(rememberSession);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function loginWithEmail(
  emailOrLoginId: string,
  password: string,
  rememberSession = true
): Promise<User> {
  await configureSessionPersistence(rememberSession);
  const resolvedEmail = await resolveIdentifierToEmail(emailOrLoginId);
  const cred = await signInWithEmailAndPassword(auth, resolvedEmail, password);
  return cred.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function sendVerificationEmailToCurrentUser(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('No signed-in user session found.');
  }
  await sendEmailVerification(auth.currentUser);
}

export interface ProvisionedAuthResult {
  status: 'created' | 'already_exists' | 'error';
  uid?: string;
  verificationSent?: boolean;
  message: string;
}

/**
 * Provisions an email/password account directly inside Firebase Authentication
 * using an isolated secondary FirebaseApp with in-memory persistence so the
 * active Super Admin or Organization Admin session is never disrupted.
 */
export async function provisionFirebaseAuthCredentials(params: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<ProvisionedAuthResult> {
  const emailLower = params.email.trim().toLowerCase();
  const password = params.password;

  if (!emailLower || !emailLower.includes('@')) {
    return { status: 'error', message: 'A valid login email address is required.' };
  }
  if (!password || password.length < 6) {
    return { status: 'error', message: 'Password must be at least 6 characters long.' };
  }

  const SECONDARY_APP_NAME = 'rexon-auth-provisioner';
  const existingApp = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, emailLower, password);
    if (params.displayName?.trim()) {
      await updateProfile(cred.user, {
        displayName: params.displayName.trim().slice(0, 120),
      }).catch(() => undefined);
    }
    let verificationSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationSent = true;
    } catch {
      verificationSent = false;
    }
    return {
      status: 'created',
      uid: cred.user.uid,
      verificationSent,
      message: verificationSent
        ? `Firebase Authentication account created for ${emailLower} and verification email dispatched.`
        : `Firebase Authentication account created for ${emailLower}. User can verify email upon sign-in.`,
    };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/email-already-in-use') {
      return {
        status: 'already_exists',
        message: `A Firebase Authentication account already exists for ${emailLower}. Use "Send Password Reset" if they need a new password.`,
      };
    }
    return {
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Unable to create Firebase Authentication credentials.',
    };
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }
}

/**
 * Links the newly created Firebase Auth UID to the invitedAccounts record and
 * pre-creates /users/{uid} in Firestore so the provisioned user can sign in immediately.
 */
export async function syncProvisionedAccountProfile(params: {
  uid: string;
  email: string;
}): Promise<void> {
  const emailLower = params.email.trim().toLowerCase();
  if (!params.uid || !emailLower) return;

  try {
    const inviteRef = doc(db, 'invitedAccounts', emailLower);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) return;

    const invite = inviteSnap.data() as InvitedAccount;
    await updateDoc(inviteRef, {
      uid: params.uid,
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    const userRef = doc(db, 'users', params.uid);
    const existingUser = await getDoc(userRef).catch(() => null);
    if (existingUser && existingUser.exists()) return;

    const cleanName = (invite.displayName || 'Workspace User').slice(0, 120);
    const userPayload: Record<string, unknown> = {
      uid: params.uid,
      email: emailLower,
      displayName: cleanName,
      fullName: cleanName,
      role: invite.role,
      permissions: invite.permissions || [],
      status: invite.status || 'active',
      accountStatus: invite.status || 'active',
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (invite.phone) userPayload.phone = invite.phone;
    if (invite.loginId) userPayload.loginId = invite.loginId;
    if (invite.employeeId) userPayload.employeeId = invite.employeeId;
    if (invite.organizationId) userPayload.organizationId = invite.organizationId;
    if (invite.organizationName) userPayload.organizationName = invite.organizationName;
    if (invite.designation) userPayload.designation = invite.designation;
    if (invite.department) userPayload.department = invite.department;

    await setDoc(userRef, userPayload).catch(() => undefined);
  } catch {
    // Non-blocking: user can still claim invitedAccounts/{emailLower} on first login
  }
}

export async function recordAuthLifecycleAudit(
  profile: UserProfile | null,
  action: 'USER_LOGIN' | 'USER_LOGOUT'
): Promise<void> {
  if (!profile || profile.status !== 'active') return;
  const summary =
    action === 'USER_LOGIN'
      ? `${profile.role} authenticated (${profile.email})`
      : `${profile.role} signed out (${profile.email})`;

  if (isCloudFunctionsEnabled()) {
    try {
      await callWriteAuditLog({
        action,
        targetCollection: 'users',
        targetId: profile.uid,
        targetUserId: profile.uid,
        organizationId: profile.organizationId,
        summary,
      });
      return;
    } catch {
      // Fall through to client audit log write
    }
  }

  try {
    const id = generateSafeId('audit');
    const payload: Record<string, unknown> = {
      id,
      actorUid: profile.uid,
      actorEmail: profile.email.slice(0, 160),
      actorRole: profile.role,
      action,
      targetCollection: 'users',
      targetId: profile.uid,
      targetUserId: profile.uid,
      summary: summary.slice(0, 300),
      createdAt: serverTimestamp(),
    };
    if (profile.organizationId) {
      payload.organizationId = profile.organizationId;
    }
    await setDoc(doc(db, 'auditLogs', id), payload);
  } catch {
    // Non-blocking lifecycle audit
  }
}

export async function logoutUser(currentProfile?: UserProfile | null): Promise<void> {
  if (currentProfile) {
    await recordAuthLifecycleAudit(currentProfile, 'USER_LOGOUT');
  }
  await signOut(auth);
}

export async function updateOwnDisplayName(uid: string, displayName: string, phone?: string): Promise<void> {
  const path = `users/${uid}`;
  const cleanName = displayName.trim().slice(0, 120);
  try {
    const updates: Record<string, unknown> = {
      displayName: cleanName,
      fullName: cleanName,
      updatedAt: serverTimestamp(),
    };
    if (phone !== undefined) {
      updates.phone = phone.trim().slice(0, 40);
    }
    await updateDoc(doc(db, 'users', uid), updates);
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: cleanName });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getSystemConfigMain(): Promise<SystemConfigMain | null> {
  try {
    const mainSnap = await getDoc(doc(db, 'systemConfig', 'main'));
    if (mainSnap.exists()) {
      return mainSnap.data() as SystemConfigMain;
    }
    const legacySnap = await getDoc(doc(db, 'systemConfig', 'superAdmin'));
    if (legacySnap.exists()) {
      const legacy = legacySnap.data();
      return {
        superAdminUid: String(legacy.superAdminUid),
        email: legacy.email ? String(legacy.email) : undefined,
        initialized: true,
        platformName: 'REXON MANAGEMENT APP',
        createdAt: legacy.createdAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureSuperAdminSingletons(uid: string, emailLower: string): Promise<boolean> {
  let mainSnap;
  try {
    mainSnap = await getDoc(doc(db, 'systemConfig', 'main'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'systemConfig/main');
  }

  let legacySnap;
  try {
    legacySnap = await getDoc(doc(db, 'systemConfig', 'superAdmin'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'systemConfig/superAdmin');
  }

  if (mainSnap.exists() && mainSnap.data()?.superAdminUid !== uid) {
    if (uid === BOOTSTRAPPED_SUPER_ADMIN_UID) {
      try {
        await updateDoc(doc(db, 'systemConfig', 'main'), {
          superAdminUid: uid,
          email: emailLower,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'systemConfig/main');
      }
    } else {
      return false;
    }
  }
  if (legacySnap.exists() && legacySnap.data()?.superAdminUid !== uid) {
    if (uid === BOOTSTRAPPED_SUPER_ADMIN_UID) {
      try {
        await updateDoc(doc(db, 'systemConfig', 'superAdmin'), {
          superAdminUid: uid,
          email: emailLower,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'systemConfig/superAdmin');
      }
    } else {
      return false;
    }
  }

  if (!mainSnap.exists()) {
    try {
      await setDoc(doc(db, 'systemConfig', 'main'), {
        superAdminUid: uid,
        email: emailLower,
        initialized: true,
        platformName: 'REXON MANAGEMENT APP',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'systemConfig/main');
    }
  }

  if (!legacySnap.exists()) {
    try {
      await setDoc(doc(db, 'systemConfig', 'superAdmin'), {
        superAdminUid: uid,
        email: emailLower,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'systemConfig/superAdmin');
    }
  }

  return true;
}

const inFlightProfileResolutions = new Map<string, Promise<UserProfile | null>>();

export async function resolveTrustedUserProfile(
  firebaseUser: User,
  forceServerRefresh = false
): Promise<UserProfile | null> {
  const key = firebaseUser.uid;
  const existingPromise = inFlightProfileResolutions.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const run = resolveTrustedUserProfileInternal(firebaseUser, forceServerRefresh).finally(() => {
    inFlightProfileResolutions.delete(key);
  });
  inFlightProfileResolutions.set(key, run);
  return run;
}

async function resolveTrustedUserProfileInternal(
  firebaseUser: User,
  forceServerRefresh = false
): Promise<UserProfile | null> {
  const uid = firebaseUser.uid;
  const userPath = `users/${uid}`;
  const emailLower = firebaseUser.email?.toLowerCase().trim() || '';

  if (!emailLower) {
    return null;
  }

  // Super Admin bootstrap & access strictly require verified email status.
  if (emailLower === BOOTSTRAPPED_SUPER_ADMIN_EMAIL && !firebaseUser.emailVerified) {
    return null;
  }

  let userSnap;
  const userRef = doc(db, 'users', uid);
  try {
    userSnap = forceServerRefresh
      ? await getDocFromServer(userRef).catch(() => getDoc(userRef))
      : await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (userSnap.exists()) {
    const existingProfile = userSnap.data() as UserProfile;
    const effectiveStatus = existingProfile.accountStatus || existingProfile.status;
    if (
      emailLower === BOOTSTRAPPED_SUPER_ADMIN_EMAIL &&
      uid === BOOTSTRAPPED_SUPER_ADMIN_UID
    ) {
      await ensureSuperAdminSingletons(uid, emailLower).catch(() => undefined);
    }
    if (effectiveStatus === 'active') {
      updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        emailVerified: Boolean(firebaseUser.emailVerified),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    return {
      ...existingProfile,
      status: effectiveStatus,
      accountStatus: effectiveStatus,
    };
  }

  // 1. Unique Super Admin bootstrap check (Single Master Account invariant)
  if (emailLower === BOOTSTRAPPED_SUPER_ADMIN_EMAIL) {
    if (isCloudFunctionsEnabled()) {
      try {
        await callInitializeSuperAdmin({
          fullName: firebaseUser.displayName || 'Super Administrator',
        });
        const initializedSnap = await getDocFromServer(userRef).catch(() => getDoc(userRef));
        if (initializedSnap.exists()) {
          return initializedSnap.data() as UserProfile;
        }
      } catch (fnErr) {
        if (!isCallableNotDeployedError(fnErr)) {
          try {
            const existingAfter = await getDoc(userRef);
            if (existingAfter.exists()) {
              return existingAfter.data() as UserProfile;
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, userPath);
          }
        }
      }
    }

    const singletonOk = await ensureSuperAdminSingletons(uid, emailLower);
    if (!singletonOk) {
      return null;
    }

    const cleanName = (firebaseUser.displayName || 'Super Administrator').slice(0, 120);
    const profilePayload: Record<string, unknown> = {
      uid,
      email: emailLower,
      displayName: cleanName,
      fullName: cleanName,
      role: 'super_admin',
      designation: 'Platform Super Administrator',
      department: 'Global Governance',
      permissions: ['all'],
      status: 'active',
      accountStatus: 'active',
      emailVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, profilePayload);
      const createdSnap = await getDoc(userRef);
      return createdSnap.exists() ? (createdSnap.data() as UserProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  }

  // 2. Check pre-authorized invitation record created by Super Admin or Org Admin
  const invitePath = `invitedAccounts/${emailLower}`;
  let inviteSnap;
  try {
    const inviteRef = doc(db, 'invitedAccounts', emailLower);
    inviteSnap = await getDoc(inviteRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  if (!inviteSnap.exists()) {
    return null;
  }

  const invite = inviteSnap.data() as InvitedAccount;
  if (invite.status !== 'active') {
    return {
      uid,
      email: emailLower,
      displayName: invite.displayName || 'User',
      role: invite.role,
      organizationId: invite.organizationId,
      organizationName: invite.organizationName,
      permissions: invite.permissions || [],
      status: invite.status,
      accountStatus: invite.status,
    };
  }

  const displayName = (firebaseUser.displayName || invite.displayName || 'Staff User').slice(0, 120);
  const invitedProfilePayload: Record<string, unknown> = {
    uid,
    email: emailLower,
    displayName,
    fullName: displayName,
    role: invite.role,
    permissions: invite.permissions || [],
    status: invite.status,
    accountStatus: invite.status,
    emailVerified: Boolean(firebaseUser.emailVerified),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  if (invite.phone) invitedProfilePayload.phone = invite.phone;
  if (invite.loginId) invitedProfilePayload.loginId = invite.loginId;
  if (invite.employeeId) invitedProfilePayload.employeeId = invite.employeeId;
  if (invite.organizationId) invitedProfilePayload.organizationId = invite.organizationId;
  if (invite.organizationName) invitedProfilePayload.organizationName = invite.organizationName;
  if (invite.designation) invitedProfilePayload.designation = invite.designation;
  if (invite.department) invitedProfilePayload.department = invite.department;

  try {
    await setDoc(userRef, invitedProfilePayload);
    const createdInvitedSnap = await getDoc(userRef);
    return createdInvitedSnap.exists() ? (createdInvitedSnap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }
}
