import { useState } from 'react';
import { Building2, Download, Edit2, Lock } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { updateOrganization } from '../../services/organizations/organizationService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { AccountStatus, OrganizationType, SubscriptionStatus } from '../../types';
import { formatDisplayDate } from '../../utils/subscriptionHelpers';

export function OrgProfilePage() {
  const {
    userProfile,
    realUserProfile,
    organization,
    isInspectingOrganization,
    refreshInspectedOrganization,
  } = useAuth();
  const { showToast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('Society');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('Active');
  const [accountStatus, setAccountStatus] = useState<AccountStatus>('active');

  const openEdit = () => {
    if (!organization || !isInspectingOrganization) return;
    setName(organization.name);
    setType(organization.type);
    setContactPerson(organization.contactPerson);
    setPhone(organization.phone);
    setEmail(organization.email);
    setAddress(organization.address);
    setSubscriptionStatus(organization.subscriptionStatus);
    setAccountStatus(organization.accountStatus);
    setEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !isInspectingOrganization) return;
    const actor = realUserProfile || userProfile;
    if (!actor) return;
    setSaving(true);
    try {
      await updateOrganization(
        organization.id,
        {
          name,
          type,
          contactPerson,
          phone,
          email,
          address,
          subscriptionStatus,
          accountStatus,
        },
        actor
      );
      await refreshInspectedOrganization(organization.id);
      showToast('Company / Society updated', 'success', `${name} profile saved.`);
      setEditOpen(false);
    } catch (err) {
      showToast('Update failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadProfilePdf = () => {
    if (!organization) return;
    exportTableToPdf({
      title: 'Company / Society Profile',
      subtitle: 'Read-only tenant profile provisioned by Super Admin',
      organizationName: organization.name,
      generatedBy: userProfile?.email || organization.adminLoginEmail || 'Company / Society Admin',
      columns: ['Profile Field', 'Registered Details'],
      rows: [
        ['Company / Society Name', organization.name],
        ['Entity Type', organization.type],
        ['Organization ID', organization.id],
        ['Contact Person', organization.contactPerson],
        ['Phone Number', organization.phone],
        ['Contact Email', organization.email],
        ['Premises Address', organization.address],
        ['Admin Login Email', organization.adminLoginEmail],
        ['Admin Login ID', organization.adminLoginId || '—'],
        ['Subscription Plan', organization.subscriptionPlanName || 'Unassigned'],
        ['Subscription Status', organization.subscriptionStatus],
        ['Subscription Start Date', organization.subscriptionStartDate || '—'],
        ['Subscription Expiry Date', organization.subscriptionExpiryDate || '—'],
        ['Account Status', organization.accountStatus],
        ['Registered On', formatDisplayDate(organization.createdAt)],
      ],
      filename: `rexon-company-profile-${organization.id}`,
    });
  };

  return (
    <DashboardLayout
      title="Company / Society Profile"
      subtitle="View your verified company or society profile details created by Super Admin and download a PDF copy."
      actions={
        organization ? (
          <div className="flex flex-wrap items-center gap-2">
            {isInspectingOrganization && (
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-100 whitespace-nowrap"
              >
                <Edit2 className="h-4 w-4" />
                <span>Edit Company / Society</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadProfilePdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Download Profile PDF</span>
            </button>
          </div>
        ) : undefined
      }
    >
      {!organization ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          No company or society record found for this account.
        </div>
      ) : (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-5 w-5 text-[#1D4ED8]" />
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Company / Society Details
                </h2>
                <p className="text-xs text-slate-500">
                  Managed by Super Admin · Read-only view for your company/society
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              <span>{isInspectingOrganization ? 'Super Admin Editable' : 'Read-Only Profile'}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Company / Society Name
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{organization.name}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Entity Type
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{organization.type}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Contact Person
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {organization.contactPerson}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Phone Number
              </p>
              <p className="mt-1 font-mono text-sm font-medium text-slate-900">
                {organization.phone}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Contact Email
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">{organization.email}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Admin Login Email / ID
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {organization.adminLoginEmail}
                {organization.adminLoginId ? ` (${organization.adminLoginId})` : ''}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Premises Address
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">{organization.address}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Assigned Plan
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {organization.subscriptionPlanName || 'Unassigned'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Subscription Standing
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusLabel status={organization.subscriptionStatus} />
                <StatusLabel status={organization.accountStatus} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Validity Period
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-slate-800 tabular-nums">
                {organization.subscriptionStartDate || '—'} to{' '}
                {organization.subscriptionExpiryDate || '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Company / Society Profile"
        subtitle="Super Admin Full Access Mode"
        maxWidth="lg"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Company / Society Name *
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
              <label className="block text-xs font-semibold text-slate-700">Entity Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OrganizationType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Company">Company</option>
                <option value="Factory">Factory</option>
                <option value="Society">Society</option>
                <option value="Apartment">Apartment</option>
                <option value="Commercial Building">Commercial Building</option>
                <option value="Industry">Industry</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact Person *</label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Phone *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Subscription Status
              </label>
              <select
                value={subscriptionStatus}
                onChange={(e) => setSubscriptionStatus(e.target.value as SubscriptionStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Suspended">Suspended</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Account Status</label>
              <select
                value={accountStatus}
                onChange={(e) => setAccountStatus(e.target.value as AccountStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
