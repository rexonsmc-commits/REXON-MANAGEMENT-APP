import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sendVerificationEmailToCurrentUser } from '../services/auth/authService';
import { getOrganizationById } from '../services/organizations/organizationService';
import { getOrganizationStaffById, getSuperAdminStaffById } from '../services/staff/staffService';
import {
  AccountStatus,
  Organization,
  OrganizationStaff,
  SuperAdminStaff,
  UserRole,
} from '../types';
import { ROLE_HOME_ROUTES } from '../config/permissions';
import { getEffectiveAccountStatus } from '../utils/rbac';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  requiredPermission?: string;
  targetOrganizationId?: string;
  children: React.ReactNode;
}

const STATUS_MESSAGES: Record<Exclude<AccountStatus, 'active'>, { title: string; detail: string }> = {
  pending: {
    title: 'Account Activation Pending',
    detail:
      'Your account has been created and is awaiting verification or activation by your administrator.',
  },
  inactive: {
    title: 'Account Deactivated',
    detail: 'Your account is currently inactive. Contact your administrator to restore access.',
  },
  suspended: {
    title: 'Account Suspended',
    detail:
      'Access to this account has been temporarily suspended by your platform or organization administrator.',
  },
  disabled: {
    title: 'Account Disabled',
    detail: 'This account has been disabled and is blocked from accessing protected resources.',
  },
};

export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const location = useLocation();
  const {
    userProfile,
    realUserProfile,
    realRole,
    inspectedOrganization,
    isInspectingOrganization,
    inspectedStaff,
    isInspectingStaff,
    enterOrganizationPortal,
    exitOrganizationPortal,
    enterStaffPortal,
    exitStaffPortal,
  } = useAuth();

  const locationState = location.state as {
    inspectOrg?: Organization;
    inspectStaff?: SuperAdminStaff | OrganizationStaff;
    inspectStaffKind?: 'super_admin_staff' | 'organization_staff';
    inspectOrgId?: string;
  } | null;

  const searchParams = new URLSearchParams(location.search);
  const inspectOrgState = locationState?.inspectOrg;
  const inspectOrgIdParam = searchParams.get('orgId');
  const inspectStaffState = locationState?.inspectStaff;
  const inspectStaffKindState = locationState?.inspectStaffKind;
  const inspectStaffIdParam = searchParams.get('staffId');

  const isTenantAdminRoute = allowedRoles.includes('organization_admin');
  const isSuperAdminStaffRoute = allowedRoles.includes('super_admin_staff');
  const isOrgStaffRoute = allowedRoles.includes('organization_staff');

  const needsOrgInspectionActivation =
    realRole === 'super_admin' &&
    isTenantAdminRoute &&
    Boolean(
      (inspectOrgState && inspectedOrganization?.id !== inspectOrgState.id) ||
        (!inspectOrgState && inspectOrgIdParam && inspectedOrganization?.id !== inspectOrgIdParam)
    );

  const needsSAStaffActivation =
    realRole === 'super_admin' &&
    isSuperAdminStaffRoute &&
    Boolean(
      (inspectStaffState &&
        inspectStaffKindState === 'super_admin_staff' &&
        (inspectedStaff?.kind !== 'super_admin_staff' ||
          inspectedStaff.staff.id !== inspectStaffState.id)) ||
        (!inspectStaffState &&
          inspectStaffIdParam &&
          (inspectedStaff?.kind !== 'super_admin_staff' ||
            inspectedStaff.staff.id !== inspectStaffIdParam))
    );

  const allowedOrgIdForStaffInspect =
    realRole === 'super_admin'
      ? inspectOrgIdParam || locationState?.inspectOrgId || inspectedOrganization?.id || ''
      : realRole === 'organization_admin'
        ? realUserProfile?.organizationId || ''
        : '';

  const canInspectOrgStaff =
    (realRole === 'organization_admin' && Boolean(realUserProfile?.organizationId)) ||
    (realRole === 'super_admin' && Boolean(allowedOrgIdForStaffInspect));

  const needsOrgStaffActivation =
    canInspectOrgStaff &&
    isOrgStaffRoute &&
    Boolean(
      (inspectStaffState &&
        inspectStaffKindState === 'organization_staff' &&
        (inspectedStaff?.kind !== 'organization_staff' ||
          inspectedStaff.staff.id !== inspectStaffState.id)) ||
        (!inspectStaffState &&
          inspectStaffIdParam &&
          (inspectedStaff?.kind !== 'organization_staff' ||
            inspectedStaff.staff.id !== inspectStaffIdParam))
    );

  const returningToSuperAdminPortal =
    (isInspectingOrganization || isInspectingStaff) &&
    realRole === 'super_admin' &&
    allowedRoles.includes('super_admin') &&
    !isTenantAdminRoute &&
    !isSuperAdminStaffRoute &&
    !isOrgStaffRoute;

  const returningToOrgAdminPortal =
    isInspectingStaff &&
    inspectedStaff?.kind === 'organization_staff' &&
    isTenantAdminRoute &&
    !isOrgStaffRoute;

  React.useEffect(() => {
    if (returningToSuperAdminPortal) {
      exitOrganizationPortal();
    } else if (returningToOrgAdminPortal) {
      exitStaffPortal();
    }
  }, [
    returningToSuperAdminPortal,
    returningToOrgAdminPortal,
    exitOrganizationPortal,
    exitStaffPortal,
  ]);

  React.useEffect(() => {
    if (!needsOrgInspectionActivation) return;
    if (inspectOrgState) {
      enterOrganizationPortal(inspectOrgState);
      return;
    }
    if (inspectOrgIdParam) {
      let active = true;
      void getOrganizationById(inspectOrgIdParam)
        .then((org) => {
          if (active && org) {
            enterOrganizationPortal(org);
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }
  }, [needsOrgInspectionActivation, inspectOrgState, inspectOrgIdParam, enterOrganizationPortal]);

  React.useEffect(() => {
    if (!needsSAStaffActivation) return;
    if (inspectStaffState && inspectStaffKindState === 'super_admin_staff') {
      enterStaffPortal({
        kind: 'super_admin_staff',
        staff: inspectStaffState as SuperAdminStaff,
      });
      return;
    }
    if (inspectStaffIdParam) {
      let active = true;
      void getSuperAdminStaffById(inspectStaffIdParam)
        .then((staff) => {
          if (active && staff) {
            enterStaffPortal({ kind: 'super_admin_staff', staff });
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }
  }, [
    needsSAStaffActivation,
    inspectStaffState,
    inspectStaffKindState,
    inspectStaffIdParam,
    enterStaffPortal,
  ]);

  React.useEffect(() => {
    if (!needsOrgStaffActivation || !allowedOrgIdForStaffInspect) return;
    const ensureOrgAndEnter = async () => {
      if (realRole === 'super_admin' && inspectedOrganization?.id !== allowedOrgIdForStaffInspect) {
        const org = await getOrganizationById(allowedOrgIdForStaffInspect).catch(() => null);
        if (!org) return;
        enterOrganizationPortal(org);
      }

      if (inspectStaffState && inspectStaffKindState === 'organization_staff') {
        const typedStaff = inspectStaffState as OrganizationStaff;
        if (typedStaff.organizationId === allowedOrgIdForStaffInspect) {
          enterStaffPortal({
            kind: 'organization_staff',
            staff: typedStaff,
            organizationId: allowedOrgIdForStaffInspect,
          });
        }
        return;
      }

      if (inspectStaffIdParam) {
        const staff = await getOrganizationStaffById(inspectStaffIdParam).catch(() => null);
        if (staff && staff.organizationId === allowedOrgIdForStaffInspect) {
          enterStaffPortal({
            kind: 'organization_staff',
            staff,
            organizationId: allowedOrgIdForStaffInspect,
          });
        }
      }
    };
    void ensureOrgAndEnter();
  }, [
    needsOrgStaffActivation,
    allowedOrgIdForStaffInspect,
    realRole,
    inspectedOrganization?.id,
    inspectStaffState,
    inspectStaffKindState,
    inspectStaffIdParam,
    enterOrganizationPortal,
    enterStaffPortal,
  ]);

  if (!userProfile) return <Navigate to="/login" replace />;
  if (
    returningToSuperAdminPortal ||
    returningToOrgAdminPortal ||
    needsOrgInspectionActivation ||
    needsSAStaffActivation ||
    needsOrgStaffActivation
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {needsSAStaffActivation || needsOrgStaffActivation
              ? 'Opening Staff Portal...'
              : 'Opening Company / Society Portal...'}
          </p>
        </div>
      </div>
    );
  }
  if (!allowedRoles.includes(userProfile.role)) {
    return <Navigate to={ROLE_HOME_ROUTES[userProfile.role]} replace />;
  }
  return <>{children}</>;
}

export function PermissionGuard({
  requiredPermission,
  children,
}: {
  requiredPermission: string;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}

export function OrganizationGuard({
  targetOrganizationId,
  children,
}: {
  targetOrganizationId?: string;
  children: React.ReactNode;
}) {
  const {
    userProfile,
    organization,
    isInspectingOrganization,
    isInspectingStaff,
    canAccessOrganization,
    signOut,
  } = useAuth();
  const location = useLocation();

  if (!userProfile) return <Navigate to="/login" replace />;

  // Super Admin or Admin in Inspection Mode has unrestricted navigation within authorized scope
  if (isInspectingOrganization || isInspectingStaff) {
    return <>{children}</>;
  }

  const isTenantRole =
    userProfile.role === 'organization_admin' || userProfile.role === 'organization_staff';

  if (targetOrganizationId && !canAccessOrganization(targetOrganizationId)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isTenantRole && !userProfile.organizationId) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isTenantRole && !organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <Ban className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
            Company / Society Access Unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your Company / Society record could not be loaded or has been removed. Please contact
            Super Admin.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Block company/society admin & staff when Super Admin has hidden their company/society
  if (isTenantRole && organization?.isHidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <Ban className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
            Your Company / Society Is Hidden
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Your company / society (<strong>{organization.name}</strong>) is hidden. Please contact
            Super Admin.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Block operational modules if organization itself is suspended/disabled
  if (isTenantRole && organization && organization.accountStatus !== 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <Ban className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
            Organization Account {organization.accountStatus}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Access for <strong>{organization.name}</strong> is currently restricted (status:{' '}
            <span className="font-semibold">{organization.accountStatus}</span>). Please contact
            REXON platform administration.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Enforce subscription status restriction on operational modules when Expired or Suspended
  const isAllowedDuringBillingHold =
    location.pathname.includes('/subscription') ||
    location.pathname.includes('/profile') ||
    location.pathname.endsWith('/dashboard');

  if (
    isTenantRole &&
    organization &&
    (organization.subscriptionStatus === 'Suspended' ||
      organization.subscriptionStatus === 'Expired') &&
    !isAllowedDuringBillingHold
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
            Subscription {organization.subscriptionStatus}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Operational modules for <strong>{organization.name}</strong> are paused while the
            organization subscription status is{' '}
            <span className="font-semibold">{organization.subscriptionStatus}</span>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {userProfile.role === 'organization_admin' && (
              <Link
                to="/organization-admin/subscription"
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF]"
              >
                Manage Subscription
              </Link>
            )}
            <Link
              to={ROLE_HOME_ROUTES[userProfile.role]}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ProtectedRoute({
  allowedRoles,
  requiredPermission,
  targetOrganizationId,
  children,
}: ProtectedRouteProps) {
  const { firebaseUser, userProfile, loading, authError, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [sendingVerification, setSendingVerification] = React.useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#1D4ED8] border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            Verifying authenticated session and permissions...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!firebaseUser.emailVerified && (!userProfile || userProfile.role === 'super_admin')) {
    const handleResend = async () => {
      setSendingVerification(true);
      try {
        await sendVerificationEmailToCurrentUser();
        showToast(
          'Verification email sent',
          'success',
          `Verification link sent to ${firebaseUser.email}.`
        );
      } catch (err) {
        showToast(
          'Verification failed',
          'error',
          err instanceof Error ? err.message : 'Unable to send verification email.'
        );
      } finally {
        setSendingVerification(false);
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8">
          <h1 className="font-display text-xl font-bold text-slate-900">
            Email Verification Required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            You are signed in as <strong className="text-slate-900">{firebaseUser.email}</strong>,
            but your email address is not verified yet. Verify your email or sign in with Google to
            access your workspace.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={sendingVerification}
              onClick={() => void handleResend()}
              className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {sendingVerification ? 'Sending...' : 'Send Verification Email'}
            </button>
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              I&apos;ve Verified — Refresh
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8">
          <h1 className="font-display text-xl font-bold text-slate-900">
            {authError ? 'Profile Sync Interrupted' : 'Account Pending Provisioning'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {authError ? (
              authError
            ) : (
              <>
                You are signed in as <strong className="text-slate-900">{firebaseUser.email}</strong>,
                but no active role assignment was found in Firestore for this account.
              </>
            )}
          </p>
          {!authError && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              In REXON MANAGEMENT APP, roles cannot be self-selected. Ask your Super Admin or
              Organization Admin to provision your email before signing in.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF]"
            >
              Retry Profile Sync
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign Out
            </button>
            <Link
              to="/"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isStaffRole =
    userProfile.role === 'super_admin_staff' || userProfile.role === 'organization_staff';
  if (isStaffRole && userProfile.isHidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <Ban className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Portal Hidden</h1>
          <p className="mt-2 text-sm text-slate-700">
            Your portal is hidden. Please contact Super Admin.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const effectiveStatus = getEffectiveAccountStatus(userProfile);
  if (effectiveStatus !== 'active') {
    const info = STATUS_MESSAGES[effectiveStatus];
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-8">
          <h1 className="font-display text-xl font-bold text-slate-900">{info.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {info.detail} ({userProfile.email})
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-[#0B192C] px-4 py-2 text-sm font-medium text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const guarded = (
    <RoleGuard allowedRoles={allowedRoles}>
      <OrganizationGuard targetOrganizationId={targetOrganizationId}>
        {requiredPermission ? (
          <PermissionGuard requiredPermission={requiredPermission}>{children}</PermissionGuard>
        ) : (
          children
        )}
      </OrganizationGuard>
    </RoleGuard>
  );

  return guarded;
}
