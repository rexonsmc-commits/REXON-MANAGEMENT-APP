import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatusLabel } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { updateOrganizationProfileByTenant } from '../../services/organizations/organizationService';

export function OrgProfilePage() {
  const { userProfile, organization, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setContactPerson(organization.contactPerson);
      setEmail(organization.email);
      setPhone(organization.phone);
      setAddress(organization.address);
    }
  }, [organization]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !organization) return;
    setSaving(true);
    try {
      await updateOrganizationProfileByTenant(
        organization.id,
        { name, contactPerson, email, phone, address },
        userProfile
      );
      await refreshProfile();
      showToast('Organization profile updated', 'success');
    } catch (err) {
      showToast('Update failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Organization Profile"
      subtitle="Manage your organization's verified contact details. Subscription status and plan tier are governed by Super Admin."
    >
      {!organization ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          No organization record found for this account.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={(e) => void handleSave(e)}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <Building2 className="h-5 w-5 text-[#1D4ED8]" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Contact & Premises Profile
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Organization Type
                </label>
                <input
                  type="text"
                  disabled
                  value={organization.type}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Contact Person</label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Premises Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Organization Profile'}
            </button>
          </form>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Tenant Governance Summary
            </h3>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Organization ID</dt>
                <dd className="font-mono text-slate-800">{organization.id}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Admin Login</dt>
                <dd className="text-slate-800">{organization.adminLoginEmail}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Account Status</dt>
                <dd>
                  <StatusLabel status={organization.accountStatus} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Subscription</dt>
                <dd>
                  <StatusLabel status={organization.subscriptionStatus} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Plan</dt>
                <dd className="font-semibold text-slate-900">
                  {organization.subscriptionPlanName || 'Unassigned'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
