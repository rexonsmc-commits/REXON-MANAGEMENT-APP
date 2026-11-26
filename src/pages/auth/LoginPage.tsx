import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { RexonLogo } from '../../components/layout/PublicLayout';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BOOTSTRAPPED_SUPER_ADMIN_EMAIL, ROLE_HOME_ROUTES } from '../../config/permissions';
import {
  loginWithEmail,
  loginWithGoogle,
  requestPasswordReset,
  sendVerificationEmailToCurrentUser,
} from '../../services/auth/authService';
import { parseFirebaseError } from '../../services/errors/errorHandler';

const loginSchema = z.object({
  email: z.string().trim().min(2, 'Enter a valid email address or Login ID'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { userProfile, firebaseUser, loading, authError, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledEmail = searchParams.get('email')?.trim() || '';

  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: prefilledEmail,
    },
  });

  useEffect(() => {
    const effectiveStatus = userProfile?.accountStatus || userProfile?.status;
    if (!loading && userProfile && effectiveStatus === 'active') {
      navigate(ROLE_HOME_ROUTES[userProfile.role], { replace: true });
    }
  }, [loading, userProfile, navigate]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setAuthSubmitting(true);
    try {
      await loginWithGoogle(rememberSession);
      await refreshProfile();
    } catch (err) {
      const parsed = parseFirebaseError(err, 'Google Sign-In could not be completed.');
      setErrorMsg(parsed.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const onEmailSubmit = async (values: LoginFormValues) => {
    setErrorMsg(null);
    setAuthSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password, rememberSession);
      await refreshProfile();
    } catch (err) {
      const parsed = parseFirebaseError(err, 'Authentication failed. Check your credentials.');
      setErrorMsg(parsed.message);
    } finally {
      setAuthSubmitting(false);
    }
  };
  const handleSendVerification = async () => {
    setVerificationSending(true);
    try {
      await sendVerificationEmailToCurrentUser();
      showToast(
        'Verification email sent',
        'success',
        `Check ${firebaseUser?.email || 'your inbox'} and click the verification link, then click Refresh Status.`
      );
    } catch (err) {
      const parsed = parseFirebaseError(err, 'Could not send verification email right now.');
      showToast('Verification Email Notice', 'error', parsed.message);
    } finally {
      setVerificationSending(false);
    }
  };

  const handleRefreshVerification = async () => {
    setAuthSubmitting(true);
    setErrorMsg(null);
    try {
      await refreshProfile();
    } finally {
      setAuthSubmitting(false);
    }
  };
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = resetEmail.trim();
    if (!cleaned) return;
    setResetSending(true);
    try {
      await requestPasswordReset(cleaned);
      showToast(
        'Reset instructions sent',
        'success',
        'If an account exists for that email, a password reset link has been sent.'
      );
      setResetOpen(false);
      setResetEmail('');
    } catch (err) {
      const parsed = parseFirebaseError(err);
      if (parsed.code === 'USER_NOT_FOUND') {
        showToast(
          'Reset instructions sent',
          'success',
          'If an account exists for that email, a password reset link has been sent.'
        );
        setResetOpen(false);
        setResetEmail('');
      } else {
        showToast('Reset request unavailable', 'error', parsed.message);
      }
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Left Brand & Architecture Panel */}
      <div className="flex flex-col justify-between bg-[#0B192C] p-8 text-white lg:w-5/12 lg:p-12">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Public Website</span>
          </Link>
          <div className="mt-8">
            <RexonLogo dark />
          </div>
          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight text-balance">
            Unified Workspace Login
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            One secure entry point for all four platform roles. Your workspace, tenant boundary,
            and module permissions are resolved automatically from your verified Firestore profile.
          </p>
        </div>

        <div className="mt-10 space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-blue-200">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Supported Platform Portals</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <li>• Super Admin (Global Platform Governance)</li>
            <li>• Super Admin Staff (Permission-Scoped Operations)</li>
            <li>• Company / Factory / Society Admin (Tenant Isolation)</li>
            <li>• Company / Factory / Society Staff (Departmental Access)</li>
          </ul>
          <p className="border-t border-slate-800 pt-3 text-[11px] text-slate-400">
            Zero-trust policy: Roles cannot be chosen during sign-in and are provisioned solely by
            authorized administrators.
          </p>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-slate-900">Sign in to REXON</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Authenticate with your provisioned account credentials.
          </p>

          {firebaseUser &&
            !loading &&
            !firebaseUser.emailVerified &&
            firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_SUPER_ADMIN_EMAIL && (
              <div className="mt-5 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                <p className="font-semibold">Email Verification Required</p>
                <p className="leading-relaxed">
                  Signed in as <strong>{firebaseUser.email}</strong>, but Super Admin access
                  requires verified email status. Verify via email below or use{' '}
                  <strong>Continue with Google</strong> for instant verified Super Admin access.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSendVerification()}
                    disabled={verificationSending || authSubmitting}
                    className="rounded-md bg-[#1D4ED8] px-3 py-1.5 font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                  >
                    {verificationSending ? 'Sending...' : 'Send Verification Email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRefreshVerification()}
                    disabled={authSubmitting}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                  >
                    I&apos;ve Verified — Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

          {firebaseUser &&
            !loading &&
            !userProfile &&
            !authError &&
            (firebaseUser.emailVerified ||
              firebaseUser.email?.toLowerCase() !== BOOTSTRAPPED_SUPER_ADMIN_EMAIL) && (
              <div className="mt-5 space-y-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                <p>
                  Signed in as <strong>{firebaseUser.email}</strong>, but no active role record
                  exists for this email yet. Ask your Super Admin or Organization Admin to provision
                  your account.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRefreshVerification()}
                    disabled={authSubmitting}
                    className="rounded-md bg-[#1D4ED8] px-3 py-1 font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                  >
                    Retry Profile Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1 font-medium text-amber-950 hover:bg-amber-100"
                  >
                    Sign Out & Switch Account
                  </button>
                </div>
              </div>
            )}

          {firebaseUser &&
            !loading &&
            userProfile &&
            (userProfile.accountStatus || userProfile.status) !== 'active' && (
              <div className="mt-5 space-y-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <p>
                  Signed in as <strong>{firebaseUser.email}</strong>, but your account status is{' '}
                  <strong className="uppercase">
                    {userProfile.accountStatus || userProfile.status}
                  </strong>
                  . Contact your administrator to activate this account.
                </p>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-md border border-rose-300 bg-white px-3 py-1 font-medium text-rose-800 hover:bg-rose-100"
                >
                  Sign Out & Switch Account
                </button>
              </div>
            )}

          {(errorMsg || authError) && (
            <div className="mt-5 space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
              <p>{errorMsg || parseFirebaseError(new Error(authError || '')).message}</p>
              {firebaseUser && !userProfile && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleRefreshVerification()}
                    disabled={authSubmitting}
                    className="rounded-md bg-[#1D4ED8] px-3 py-1 font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-md border border-rose-300 bg-white px-3 py-1 font-medium text-rose-800 hover:bg-rose-100"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Primary Google Sign-In (Configured out of the box) */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={authSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{authSubmitting ? 'Authenticating...' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">or sign in with email / Login ID</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email / Login ID</label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoComplete="username"
                  {...register('email')}
                  placeholder="name@organization.com or login-id"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="text-xs font-medium text-[#1D4ED8] hover:text-[#1E40AF]"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-10 text-sm focus:border-[#1D4ED8] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
                />
                <span>Remember session on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF] transition-colors disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              <span>{authSubmitting ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Need a new organization provisioned?{' '}
            <Link to="/contact" className="font-semibold text-[#1D4ED8] hover:underline">
              Contact Onboarding Desk
            </Link>
          </p>
        </div>
      </div>

      {/* Password Reset Modal */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Account Password"
        subtitle="Enter your registered login email to receive a Firebase password reset link."
        maxWidth="md"
      >
        <form onSubmit={(e) => void handlePasswordReset(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Email Address</label>
            <input
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="name@organization.com"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetSending}
              className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {resetSending ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
