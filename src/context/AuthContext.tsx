import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import {
  logoutUser,
  recordAuthLifecycleAudit,
  resolveTrustedUserProfile,
} from '../services/auth/authService';
import { getOrganizationById } from '../services/organizations/organizationService';
import { getOrganizationStaffById, getSuperAdminStaffById } from '../services/staff/staffService';
import {
  AccountStatus,
  Organization,
  OrganizationStaff,
  SuperAdminStaff,
  UserProfile,
  UserRole,
} from '../types';
import {
  canAccessOrganization as rbacCanAccessOrganization,
  getEffectiveAccountStatus,
  hasPermission as rbacHasPermission,
  hasRole as rbacHasRole,
  isOrganizationAdmin as rbacIsOrganizationAdmin,
  isOrganizationStaff as rbacIsOrganizationStaff,
  isSuperAdmin as rbacIsSuperAdmin,
} from '../utils/rbac';

const INSPECT_ORG_STORAGE_KEY = 'rexon_super_admin_inspect_org_id';
const INSPECT_STAFF_STORAGE_KEY = 'rexon_super_admin_inspect_staff';

export type InspectedStaffContext =
  | {
      kind: 'super_admin_staff';
      staff: SuperAdminStaff;
    }
  | {
      kind: 'organization_staff';
      staff: OrganizationStaff;
      organizationId: string;
    };

interface SavedInspectedStaff {
  kind: 'super_admin_staff' | 'organization_staff';
  staffId: string;
  organizationId?: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  realUserProfile: UserProfile | null;
  organization: Organization | null;
  inspectedOrganization: Organization | null;
  isInspectingOrganization: boolean;
  inspectedStaff: InspectedStaffContext | null;
  isInspectingStaff: boolean;
  role: UserRole | null;
  realRole: UserRole | null;
  organizationId: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  accountStatus: AccountStatus | null;
  loading: boolean;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  enterOrganizationPortal: (org: Organization) => void;
  exitOrganizationPortal: () => void;
  enterStaffPortal: (target: InspectedStaffContext) => void;
  exitStaffPortal: () => void;
  refreshInspectedOrganization: (orgId?: string) => Promise<void>;
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
  const [rawUserProfile, setRawUserProfile] = useState<UserProfile | null>(null);
  const [tenantOrganization, setTenantOrganization] = useState<Organization | null>(null);
  const [inspectedOrganization, setInspectedOrganization] = useState<Organization | null>(null);
  const [inspectedStaff, setInspectedStaff] = useState<InspectedStaffContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastLoggedLoginUid = useRef<string | null>(null);

  const clearOrgInspectionStorage = () => {
    try {
      sessionStorage.removeItem(INSPECT_ORG_STORAGE_KEY);
    } catch {
      // Ignore storage access restrictions
    }
  };

  const clearStaffInspectionStorage = () => {
    try {
      sessionStorage.removeItem(INSPECT_STAFF_STORAGE_KEY);
    } catch {
      // Ignore storage access restrictions
    }
  };

  const clearAllInspectionStorage = () => {
    clearOrgInspectionStorage();
    clearStaffInspectionStorage();
  };

  const loadTrustedContext = useCallback(async (fbUser: User | null, forceServerRefresh = false) => {
    if (!fbUser) {
      setRawUserProfile(null);
      setTenantOrganization(null);
      setInspectedOrganization(null);
      setInspectedStaff(null);
      clearAllInspectionStorage();
      setAuthError(null);
      setLoading(false);
      lastLoggedLoginUid.current = null;
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      let activeUser = fbUser;
      if (!activeUser.emailVerified) {
        await activeUser.reload().catch(() => undefined);
        activeUser = auth.currentUser || activeUser;
        setFirebaseUser(activeUser);
      }

      const tokenResult = await activeUser.getIdTokenResult().catch(() => null);
      if (
        forceServerRefresh ||
        (activeUser.emailVerified && tokenResult?.claims?.email_verified !== true)
      ) {
        await activeUser.getIdToken(true).catch(() => undefined);
      }

      const profile = await resolveTrustedUserProfile(activeUser, forceServerRefresh);
      setRawUserProfile(profile);

      if (profile && getEffectiveAccountStatus(profile) === 'active' && !profile.isHidden) {
        if (lastLoggedLoginUid.current !== profile.uid) {
          lastLoggedLoginUid.current = profile.uid;
          void recordAuthLifecycleAudit(profile, 'USER_LOGIN');
        }
      }

      let savedStaffRaw: string | null = null;
      try {
        savedStaffRaw = sessionStorage.getItem(INSPECT_STAFF_STORAGE_KEY);
      } catch {
        savedStaffRaw = null;
      }
      let parsedSavedStaff: SavedInspectedStaff | null = null;
      if (savedStaffRaw) {
        try {
          parsedSavedStaff = JSON.parse(savedStaffRaw) as SavedInspectedStaff;
        } catch {
          clearStaffInspectionStorage();
        }
      }

      if (profile?.role === 'super_admin') {
        setTenantOrganization(null);
        let savedInspectOrgId: string | null = null;
        try {
          savedInspectOrgId = sessionStorage.getItem(INSPECT_ORG_STORAGE_KEY);
        } catch {
          savedInspectOrgId = null;
        }

        let resolvedInspectedOrg: Organization | null = null;
        if (savedInspectOrgId) {
          const inspected = await getOrganizationById(savedInspectOrgId).catch(() => null);
          if (inspected) {
            resolvedInspectedOrg = inspected;
            setInspectedOrganization(inspected);
          } else {
            setInspectedOrganization(null);
            clearOrgInspectionStorage();
          }
        } else {
          setInspectedOrganization(null);
        }

        if (parsedSavedStaff?.kind === 'super_admin_staff' && parsedSavedStaff.staffId) {
          const staff = await getSuperAdminStaffById(parsedSavedStaff.staffId).catch(() => null);
          if (staff) {
            setInspectedStaff({ kind: 'super_admin_staff', staff });
          } else {
            setInspectedStaff(null);
            clearStaffInspectionStorage();
          }
        } else if (
          parsedSavedStaff?.kind === 'organization_staff' &&
          parsedSavedStaff.staffId &&
          parsedSavedStaff.organizationId
        ) {
          const targetOrg =
            resolvedInspectedOrg && resolvedInspectedOrg.id === parsedSavedStaff.organizationId
              ? resolvedInspectedOrg
              : await getOrganizationById(parsedSavedStaff.organizationId).catch(() => null);
          const staff = await getOrganizationStaffById(parsedSavedStaff.staffId).catch(() => null);
          if (
            targetOrg &&
            staff &&
            staff.organizationId === targetOrg.id
          ) {
            setInspectedOrganization(targetOrg);
            try {
              sessionStorage.setItem(INSPECT_ORG_STORAGE_KEY, targetOrg.id);
            } catch {
              // Ignore storage restrictions
            }
            setInspectedStaff({
              kind: 'organization_staff',
              staff,
              organizationId: targetOrg.id,
            });
          } else {
            setInspectedStaff(null);
            clearStaffInspectionStorage();
          }
        } else {
          setInspectedStaff(null);
        }
      } else {
        setInspectedOrganization(null);
        clearOrgInspectionStorage();

        let loadedTenantOrg: Organization | null = null;
        if (profile?.organizationId) {
          try {
            loadedTenantOrg = await getOrganizationById(profile.organizationId);
            setTenantOrganization(loadedTenantOrg);
          } catch {
            setTenantOrganization(null);
          }
        } else {
          setTenantOrganization(null);
        }

        if (
          profile?.role === 'organization_admin' &&
          profile.organizationId &&
          parsedSavedStaff?.kind === 'organization_staff' &&
          parsedSavedStaff.staffId &&
          parsedSavedStaff.organizationId === profile.organizationId
        ) {
          const staff = await getOrganizationStaffById(parsedSavedStaff.staffId).catch(() => null);
          if (staff && staff.organizationId === profile.organizationId) {
            setInspectedStaff({
              kind: 'organization_staff',
              staff,
              organizationId: profile.organizationId,
            });
          } else {
            setInspectedStaff(null);
            clearStaffInspectionStorage();
          }
        } else {
          setInspectedStaff(null);
          clearStaffInspectionStorage();
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to resolve user profile');
      setRawUserProfile(null);
      setTenantOrganization(null);
      setInspectedOrganization(null);
      setInspectedStaff(null);
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
    const currentProfile = rawUserProfile;
    lastLoggedLoginUid.current = null;
    clearAllInspectionStorage();
    setFirebaseUser(null);
    setRawUserProfile(null);
    setTenantOrganization(null);
    setInspectedOrganization(null);
    setInspectedStaff(null);
    await logoutUser(currentProfile);
  }, [rawUserProfile]);

  const enterOrganizationPortal = useCallback(
    (org: Organization) => {
      if (rawUserProfile?.role !== 'super_admin') return;
      clearStaffInspectionStorage();
      setInspectedStaff(null);
      try {
        sessionStorage.setItem(INSPECT_ORG_STORAGE_KEY, org.id);
      } catch {
        // Ignore storage errors
      }
      setInspectedOrganization(org);
    },
    [rawUserProfile?.role]
  );

  const exitOrganizationPortal = useCallback(() => {
    clearAllInspectionStorage();
    setInspectedStaff(null);
    setInspectedOrganization(null);
  }, []);

  const enterStaffPortal = useCallback(
    (target: InspectedStaffContext) => {
      if (target.kind === 'super_admin_staff') {
        if (rawUserProfile?.role !== 'super_admin') return;
        try {
          sessionStorage.setItem(
            INSPECT_STAFF_STORAGE_KEY,
            JSON.stringify({ kind: 'super_admin_staff', staffId: target.staff.id })
          );
        } catch {
          // Ignore storage errors
        }
        setInspectedStaff(target);
        return;
      }

      const allowedOrgId =
        rawUserProfile?.role === 'super_admin' && inspectedOrganization
          ? inspectedOrganization.id
          : rawUserProfile?.role === 'organization_admin'
            ? rawUserProfile.organizationId
            : null;

      if (
        !allowedOrgId ||
        target.organizationId !== allowedOrgId ||
        target.staff.organizationId !== allowedOrgId
      ) {
        return;
      }

      try {
        sessionStorage.setItem(
          INSPECT_STAFF_STORAGE_KEY,
          JSON.stringify({
            kind: 'organization_staff',
            staffId: target.staff.id,
            organizationId: allowedOrgId,
          })
        );
      } catch {
        // Ignore storage errors
      }
      setInspectedStaff(target);
    },
    [rawUserProfile?.role, rawUserProfile?.organizationId, inspectedOrganization]
  );

  const exitStaffPortal = useCallback(() => {
    clearStaffInspectionStorage();
    setInspectedStaff(null);
  }, []);

  const refreshInspectedOrganization = useCallback(
    async (orgId?: string) => {
      const targetId = orgId || inspectedOrganization?.id;
      if (!targetId || rawUserProfile?.role !== 'super_admin') return;
      const latest = await getOrganizationById(targetId).catch(() => null);
      if (latest) {
        setInspectedOrganization(latest);
      }
    },
    [inspectedOrganization?.id, rawUserProfile?.role]
  );

  const isInspectingOrganization = Boolean(
    rawUserProfile?.role === 'super_admin' && inspectedOrganization
  );

  const isInspectingStaff = useMemo(() => {
    if (!inspectedStaff || !rawUserProfile) return false;
    if (inspectedStaff.kind === 'super_admin_staff') {
      return rawUserProfile.role === 'super_admin';
    }
    if (rawUserProfile.role === 'super_admin') {
      return Boolean(
        inspectedOrganization &&
          inspectedOrganization.id === inspectedStaff.organizationId &&
          inspectedStaff.staff.organizationId === inspectedOrganization.id
      );
    }
    if (rawUserProfile.role === 'organization_admin') {
      return Boolean(
        rawUserProfile.organizationId &&
          rawUserProfile.organizationId === inspectedStaff.organizationId &&
          inspectedStaff.staff.organizationId === rawUserProfile.organizationId
      );
    }
    return false;
  }, [inspectedStaff, rawUserProfile, inspectedOrganization]);

  const effectiveOrganization = isInspectingOrganization
    ? inspectedOrganization
    : tenantOrganization;

  const effectiveUserProfile = useMemo<UserProfile | null>(() => {
    if (!rawUserProfile) return null;

    if (isInspectingStaff && inspectedStaff) {
      if (inspectedStaff.kind === 'super_admin_staff') {
        return {
          ...rawUserProfile,
          role: 'super_admin_staff',
          organizationId: undefined,
          organizationName: undefined,
          displayName: inspectedStaff.staff.name,
          fullName: inspectedStaff.staff.name,
          email: inspectedStaff.staff.email,
          phone: inspectedStaff.staff.phone,
          loginId: inspectedStaff.staff.loginId,
          designation: inspectedStaff.staff.designation,
          department: inspectedStaff.staff.department,
          permissions: [...(inspectedStaff.staff.permissions || [])],
          status: 'active',
          accountStatus: 'active',
          isHidden: false,
        };
      }

      return {
        ...rawUserProfile,
        role: 'organization_staff',
        organizationId: inspectedStaff.organizationId,
        organizationName: effectiveOrganization?.name || rawUserProfile.organizationName,
        employeeId: inspectedStaff.staff.employeeId,
        displayName: inspectedStaff.staff.name,
        fullName: inspectedStaff.staff.name,
        email: inspectedStaff.staff.email,
        phone: inspectedStaff.staff.phone,
        loginId: inspectedStaff.staff.loginId,
        designation: inspectedStaff.staff.designation,
        department: inspectedStaff.staff.department,
        permissions: [...(inspectedStaff.staff.permissions || [])],
        status: 'active',
        accountStatus: 'active',
        isHidden: false,
      };
    }

    if (isInspectingOrganization && inspectedOrganization) {
      return {
        ...rawUserProfile,
        role: 'organization_admin',
        organizationId: inspectedOrganization.id,
        organizationName: inspectedOrganization.name,
        permissions: [
          'all',
          'view_dashboard',
          'view_staff',
          'manage_staff',
          'view_properties',
          'manage_properties',
          'view_reports',
          'export_pdf',
          'access_settings',
        ],
        isHidden: false,
      };
    }

    return rawUserProfile;
  }, [
    rawUserProfile,
    isInspectingStaff,
    inspectedStaff,
    isInspectingOrganization,
    inspectedOrganization,
    effectiveOrganization?.name,
  ]);

  const hasPermission = useCallback(
    (permission: string) => rbacHasPermission(effectiveUserProfile, permission),
    [effectiveUserProfile]
  );

  const hasRole = useCallback(
    (roles: UserRole[]) => rbacHasRole(effectiveUserProfile, roles),
    [effectiveUserProfile]
  );

  const isSuperAdmin = useCallback(
    () => rbacIsSuperAdmin(effectiveUserProfile),
    [effectiveUserProfile]
  );
  const isOrganizationAdmin = useCallback(
    () => rbacIsOrganizationAdmin(effectiveUserProfile),
    [effectiveUserProfile]
  );
  const isOrganizationStaff = useCallback(
    () => rbacIsOrganizationStaff(effectiveUserProfile),
    [effectiveUserProfile]
  );
  const canAccessOrganization = useCallback(
    (orgId: string) => rbacCanAccessOrganization(effectiveUserProfile, orgId),
    [effectiveUserProfile]
  );

  const accountStatus = rawUserProfile ? getEffectiveAccountStatus(rawUserProfile) : null;
  const isAuthenticated = Boolean(firebaseUser && rawUserProfile && accountStatus === 'active');

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile: effectiveUserProfile,
        realUserProfile: rawUserProfile,
        organization: effectiveOrganization,
        inspectedOrganization,
        isInspectingOrganization,
        inspectedStaff,
        isInspectingStaff,
        role: effectiveUserProfile?.role || null,
        realRole: rawUserProfile?.role || null,
        organizationId: effectiveOrganization?.id || effectiveUserProfile?.organizationId || null,
        permissions: effectiveUserProfile?.permissions || [],
        isAuthenticated,
        accountStatus,
        loading,
        authError,
        refreshProfile,
        signOut,
        enterOrganizationPortal,
        exitOrganizationPortal,
        enterStaffPortal,
        exitStaffPortal,
        refreshInspectedOrganization,
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
