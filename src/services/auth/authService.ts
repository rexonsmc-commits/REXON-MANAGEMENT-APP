import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
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
import { BOOTSTRAPPED_SUPER_ADMIN_EMAIL } from '../../config/permissions';
import { InvitedAccount, SystemConfigMain, UserProfile } from '../../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
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

export async function resolveTrustedUserProfile(
  firebaseUser: User,
  forceServerRefresh = false
): Promise<UserProfile | null> {
  const uid = firebaseUser.uid;
  const userPath = `users/${uid}`;
  const emailLower = firebaseUser.email?.toLowerCase().trim() || '';

  // Firestore security rules require a verified email token (`email_verified == true`)
  // for workspace reads/writes and initial provisioning.
  if (!emailLower || !firebaseUser.emailVerified) {
    return null;
  }

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = forceServerRefresh
      ? await getDocFromServer(userRef).catch(() => getDoc(userRef))
      : await getDoc(userRef);

    if (userSnap.exists()) {
      const existingProfile = userSnap.data() as UserProfile;
      const effectiveStatus = existingProfile.accountStatus || existingProfile.status;
      if (effectiveStatus === 'active' && firebaseUser.emailVerified) {
        updateDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          emailVerified: firebaseUser.emailVerified,
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
            const existingAfter = await getDoc(userRef);
            if (existingAfter.exists()) {
              return existingAfter.data() as UserProfile;
            }
          }
        }
      }

      const mainSnap = await getDoc(doc(db, 'systemConfig', 'main'));
      const legacySnap = await getDoc(doc(db, 'systemConfig', 'superAdmin'));

      if (mainSnap.exists() && mainSnap.data()?.superAdminUid !== uid) {
        return null;
      }
      if (legacySnap.exists() && legacySnap.data()?.superAdminUid !== uid) {
        return null;
      }

      if (!mainSnap.exists()) {
        await setDoc(doc(db, 'systemConfig', 'main'), {
          superAdminUid: uid,
          email: emailLower,
          initialized: true,
          platformName: 'REXON MANAGEMENT APP',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (!legacySnap.exists()) {
        await setDoc(doc(db, 'systemConfig', 'superAdmin'), {
          superAdminUid: uid,
          email: emailLower,
          createdAt: serverTimestamp(),
        });
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

      await setDoc(userRef, profilePayload);
      const createdSnap = await getDoc(userRef);
      return createdSnap.exists() ? (createdSnap.data() as UserProfile) : null;
    }

    // 2. Check pre-authorized invitation record created by Super Admin or Org Admin
    const inviteRef = doc(db, 'invitedAccounts', emailLower);
    const inviteSnap = await getDoc(inviteRef);
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
      emailVerified: true,
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

    await setDoc(userRef, invitedProfilePayload);
    const createdInvitedSnap = await getDoc(userRef);
    return createdInvitedSnap.exists() ? (createdInvitedSnap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}
