import { useState } from 'react';
import { KeyRound, ShieldCheck, UserCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatusLabel } from '../../components/common/StatusBadge';
import { ROLE_LABELS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { requestPasswordReset, updateOwnDisplayName } from '../../services/auth/authService';

export function ProfilePage() {
  const { userProfile, organization, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [saving, setSaving] = useState(false);

  if (!userProfile) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateOwnDisplayName(userProfile.uid, displayName);
      await refreshProfile();
      showToast('Profile updated', 'success', 'Your display name has been updated.');
    } catch (err) {
      showToast('Update failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await requestPasswordReset(userProfile.email);
      showToast('Password reset link sent', 'success', `Check ${userProfile.email}.`);
    } catch (err) {
      showToast('Reset request failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <DashboardLayout
      title="Account Profile & Permissions"
      subtitle="Manage your display name, inspect assigned permissions, and trigger Firebase password reset."
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
              <UserCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {userProfile.displayName}
              </h2>
              <p className="text-xs text-slate-500">{userProfile.email}</p>
            </div>
          </div>

          <form onSubmit={(e) => void handleSaveProfile(e)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Assigned Role</label>
                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                  {ROLE_LABELS[userProfile.role]}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Account Status</label>
                <div className="mt-1.5">
                  <StatusLabel status={userProfile.status} />
                </div>
              </div>
            </div>

            {organization && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tenant Organization
                </label>
                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {organization.name} ({organization.type})
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Update Name'}
              </button>
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <KeyRound className="h-4 w-4" />
                <span>Send Password Reset Email</span>
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Trusted Permission Scope
            </h2>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Permissions are enforced in Firestore Security Rules and cannot be modified by the
            authenticated user.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {userProfile.role === 'super_admin' ? (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1D4ED8]">
                Global Super Admin (All Platform Authorities)
              </span>
            ) : userProfile.role === 'organization_admin' ? (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1D4ED8]">
                Organization Admin (Full Tenant Authority for {organization?.name || userProfile.organizationId})
              </span>
            ) : userProfile.permissions.length > 0 ? (
              userProfile.permissions.map((perm) => (
                <span
                  key={perm}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-800"
                >
                  {perm}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">No module permissions assigned yet.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
