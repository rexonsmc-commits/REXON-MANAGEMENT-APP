import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import {
  logoutUser,
  recordAuthLifecycleAudit,
  resolveTrustedUserProfile,
} from '../services/auth/authService';
import { getOrganizationById } from '../services/organizations/organizationService';
import { AccountStatus, Organization, UserProfile, UserRole } from '../types';
import {
  canAccessOrganization as rbacCanAccessOrganization,
  getEffectiveAccountStatus,
  hasPermission as rbacHasPermission,
  hasRole as rbacHasRole,
  isOrganizationAdmin as rbacIsOrganizationAdmin,
  isOrganizationStaff as rbacIsOrganizationStaff,
  isSuperAdmin as rbacIsSuperAdmin,
} from '../utils/rbac';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  organization: Organization | null;
  role: UserRole | null;
  organizationId: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  accountStatus: AccountStatus | null;
  loading: boolean;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isSuperAdmin: () => boolean;
  isOrganizationAdmin: () => boolean;
  isOrganizationStaff: () => boolean;
  canAccessOrganization: (organizationId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastLoggedLoginUid = useRef<string | null>(null);

  const loadTrustedContext = useCallback(async (fbUser: User | null, forceServerRefresh = false) => {
    if (!fbUser) {
      setUserProfile(null);
      setOrganization(null);
      setAuthError(null);
      setLoading(false);
      lastLoggedLoginUid.current = null;
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      if (forceServerRefresh) {
        await fbUser.getIdToken(true).catch(() => undefined);
      }

      const profile = await resolveTrustedUserProfile(fbUser, forceServerRefresh);
      setUserProfile(profile);

      if (profile && getEffectiveAccountStatus(profile) === 'active') {
        if (lastLoggedLoginUid.current !== profile.uid) {
          lastLoggedLoginUid.current = profile.uid;
          void recordAuthLifecycleAudit(profile, 'USER_LOGIN');
        }
      }

      if (profile?.organizationId) {
        try {
          const org = await getOrganizationById(profile.organizationId);
          setOrganization(org);
        } catch {
          setOrganization(null);
        }
      } else {
        setOrganization(null);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to resolve user profile');
      setUserProfile(null);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      void loadTrustedContext(fbUser, false);
    });
    return () => unsubscribe();
  }, [loadTrustedContext]);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (current) {
      await current.reload().catch(() => undefined);
      setFirebaseUser(auth.currentUser);
    }
    await loadTrustedContext(auth.currentUser, true);
  }, [loadTrustedContext]);

  const signOut = useCallback(async () => {
    await logoutUser(userProfile);
    lastLoggedLoginUid.current = null;
    setFirebaseUser(null);
    setUserProfile(null);
    setOrganization(null);
  }, [userProfile]);

  const hasPermission = useCallback(
    (permission: string) => rbacHasPermission(userProfile, permission),
    [userProfile]
  );

  const hasRole = useCallback(
    (roles: UserRole[]) => rbacHasRole(userProfile, roles),
    [userProfile]
  );

  const isSuperAdmin = useCallback(() => rbacIsSuperAdmin(userProfile), [userProfile]);
  const isOrganizationAdmin = useCallback(
    () => rbacIsOrganizationAdmin(userProfile),
    [userProfile]
  );
  const isOrganizationStaff = useCallback(
    () => rbacIsOrganizationStaff(userProfile),
    [userProfile]
  );
  const canAccessOrganization = useCallback(
    (orgId: string) => rbacCanAccessOrganization(userProfile, orgId),
    [userProfile]
  );

  const accountStatus = userProfile ? getEffectiveAccountStatus(userProfile) : null;
  const isAuthenticated = Boolean(firebaseUser && userProfile && accountStatus === 'active');

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        organization,
        role: userProfile?.role || null,
        organizationId: userProfile?.organizationId || null,
        permissions: userProfile?.permissions || [],
        isAuthenticated,
        accountStatus,
        loading,
        authError,
        refreshProfile,
        signOut,
        hasPermission,
        hasRole,
        isSuperAdmin,
        isOrganizationAdmin,
        isOrganizationStaff,
        canAccessOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
