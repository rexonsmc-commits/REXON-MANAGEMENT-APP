import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sendVerificationEmailToCurrentUser } from '../services/auth/authService';
import { AccountStatus, UserRole } from '../types';
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
  const { userProfile } = useAuth();
  if (!userProfile) return <Navigate to="/login" replace />;
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
  const { userProfile, organization, canAccessOrganization, signOut } = useAuth();
  const location = useLocation();

  if (!userProfile) return <Navigate to="/login" replace />;

  const isTenantRole =
    userProfile.role === 'organization_admin' || userProfile.role === 'organization_staff';

  if (targetOrganizationId && !canAccessOrganization(targetOrganizationId)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isTenantRole && !userProfile.organizationId) {
    return <Navigate to="/unauthorized" replace />;
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
