import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { provisionFirebaseAuthCredentials } from '../../services/auth/authService';
import { issuePasswordSetupInvite } from '../../services/staff/staffService';
import { useToast } from '../../context/ToastContext';

interface LoginCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  entityLabel: string;
  targetName: string;
  email: string;
  loginId?: string;
  initialPassword?: string;
  authStatusMessage?: string;
  onAuthProvisioned?: (uid: string) => Promise<void> | void;
}

export function generateStrongPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!';
  const all = upper + lower + digits + symbols;
  const picks = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = picks.length; i < length; i++) {
    picks.push(all[Math.floor(Math.random() * all.length)]);
  }
  return picks.sort(() => Math.random() - 0.5).join('');
}

export function LoginCredentialsModal({
  open,
  onClose,
  entityLabel,
  targetName,
  email,
  loginId,
  initialPassword,
  authStatusMessage,
  onAuthProvisioned,
}: LoginCredentialsModalProps) {
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAuth, setCreatingAuth] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setShowPassword(false);
      setCopiedField(null);
      setStatusBanner(authStatusMessage || null);
    }
  }, [open, authStatusMessage]);

  const loginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/login?email=${encodeURIComponent(email)}`
      : `/login?email=${encodeURIComponent(email)}`;

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast('Copy unavailable', 'error', 'Please copy the text manually.');
    }
  };

  const handleProvisionAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      showToast('Invalid password', 'error', 'Password must be at least 6 characters.');
      return;
    }
    setCreatingAuth(true);
    try {
      const res = await provisionFirebaseAuthCredentials({
        email,
        password,
        displayName: targetName,
      });
      setStatusBanner(res.message);
      if (res.status === 'created') {
        if (res.uid && onAuthProvisioned) {
          await onAuthProvisioned(res.uid);
        }
        showToast('Saved to Firebase Auth', 'success', res.message);
      } else if (res.status === 'already_exists') {
        showToast('Account already in Firebase Auth', 'info', res.message);
      } else {
        showToast('Auth creation failed', 'error', res.message);
      }
    } finally {
      setCreatingAuth(false);
    }
  };

  const handleSendReset = async () => {
    setSendingReset(true);
    try {
      const msg = await issuePasswordSetupInvite(email);
      setStatusBanner(msg);
      showToast('Password reset link sent', 'success', msg);
    } catch (err) {
      showToast('Failed to send reset email', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${entityLabel} — Login ID & Password Access`}
      subtitle={`Share this login link and Firebase Authentication credentials with ${targetName}.`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {statusBanner && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p className="leading-relaxed">{statusBanner}</p>
          </div>
        )}

        {/* Direct Portal Login Link */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Link2 className="h-3.5 w-3.5 text-[#1D4ED8]" />
              Dashboard Login Link
            </span>
            <button
              type="button"
              onClick={() => void handleCopy('url', loginUrl)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              {copiedField === 'url' ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
          <p className="mt-1.5 break-all rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-700">
            {loginUrl}
          </p>
        </div>

        {/* Credentials Summary */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                Login Email (Firebase Auth ID)
              </span>
              <button
                type="button"
                onClick={() => void handleCopy('email', email)}
                className="text-[11px] font-semibold text-[#1D4ED8] hover:underline"
              >
                {copiedField === 'email' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-900">{email}</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-[11px] font-semibold text-slate-500">Custom Login ID</span>
            <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-900">
              {loginId || '— (Use Login Email)'}
            </p>
          </div>
        </div>

        {initialPassword && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-950">
                Configured Login Password (Copy Now)
              </span>
              <button
                type="button"
                onClick={() =>
                  void handleCopy(
                    'creds',
                    `Login Link: ${loginUrl}\nLogin Email: ${email}\nPassword: ${initialPassword}`
                  )
                }
                className="inline-flex items-center gap-1 rounded-md bg-[#1D4ED8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E40AF]"
              >
                {copiedField === 'creds' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedField === 'creds' ? 'Copied All' : 'Copy Link + ID + Password'}</span>
              </button>
            </div>
            <p className="mt-1.5 font-mono text-sm font-bold text-slate-900">{initialPassword}</p>
            <p className="mt-1 text-[11px] text-blue-900">
              Stored securely inside Firebase Authentication (never stored in plain text in Firestore).
              The user should verify their email link if prompted on first login.
            </p>
          </div>
        )}

        {/* Provision / Reset in Firebase Auth */}
        {!initialPassword && (
          <form
            onSubmit={(e) => void handleProvisionAuth(e)}
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <KeyRound className="h-3.5 w-3.5 text-[#1D4ED8]" />
                <span>Create / Save Password in Firebase Authentication</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateStrongPassword());
                  setShowPassword(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D4ED8] hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Generate Password</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter login password (min 6 chars)"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm focus:border-[#1D4ED8] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={creatingAuth}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap"
              >
                {creatingAuth ? 'Saving to Auth...' : 'Save ID & Password'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-[11px] text-slate-600">
              <span>Already registered in Firebase Auth? Send a password setup/reset link:</span>
              <button
                type="button"
                onClick={() => void handleSendReset()}
                disabled={sendingReset}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <Mail className="h-3 w-3" />
                <span>{sendingReset ? 'Sending...' : 'Send Password Reset Email'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0B192C] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
