import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Edit2, KeyRound, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createOrganization,
  deleteOrganization,
  listOrganizations,
  updateOrganization,
} from '../../services/organizations/organizationService';
import { issuePasswordSetupInvite } from '../../services/staff/staffService';
import { listAllSubscriptionPlans } from '../../services/subscriptions/subscriptionService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Organization, OrganizationType, SubscriptionPlan } from '../../types';
import { DEMO_ORGANIZATIONS, SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name required').max(160),
  type: z.enum([
    'Company',
    'Factory',
    'Society',
    'Apartment',
    'Commercial Building',
    'Industry',
    'Other',
  ]),
  contactPerson: z.string().min(2, 'Contact person required').max(120),
  email: z.string().email('Valid email required').max(160),
  phone: z.string().min(5, 'Valid phone required').max(40),
  address: z.string().min(3, 'Address required').max(300),
  adminLoginEmail: z.string().email('Valid admin login email required').max(160),
  adminLoginId: z.string().max(80).optional(),
  subscriptionPlanId: z.string().optional(),
  subscriptionStatus: z.enum(['Pending', 'Active', 'Expired', 'Suspended', 'Cancelled']),
  subscriptionStartDate: z.string().optional(),
  subscriptionExpiryDate: z.string().optional(),
  accountStatus: z.enum(['pending', 'active', 'inactive', 'suspended', 'disabled']),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export function OrganizationsPage() {
  const { userProfile, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = userProfile?.role === 'super_admin' || hasPermission('create_organizations') || hasPermission('manage_organizations');
  const canEdit = userProfile?.role === 'super_admin' || hasPermission('edit_organizations') || hasPermission('manage_organizations');
  const canDelete = userProfile?.role === 'super_admin' || hasPermission('delete_organizations');
  const canExport = userProfile?.role === 'super_admin' || hasPermission('export_pdf');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      type: 'Society',
      subscriptionStatus: 'Pending',
      accountStatus: 'active',
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsData, plansData] = await Promise.all([
        listOrganizations(),
        listAllSubscriptionPlans().catch(() => []),
      ]);
      setOrganizations(orgsData);
      if (plansData.length > 0) setPlans(plansData);
    } catch (err) {
      showToast('Failed to load organizations', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeDataset = demoPreview ? DEMO_ORGANIZATIONS : organizations;

  const filteredData = useMemo(() => {
    return activeDataset.filter((o) => {
      const matchesSearch =
        !search.trim() ||
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        o.adminLoginEmail.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || o.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || o.accountStatus === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [activeDataset, search, typeFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingOrg(null);
    reset({
      name: '',
      type: 'Society',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      adminLoginEmail: '',
      adminLoginId: '',
      subscriptionPlanId: plans[0]?.id || '',
      subscriptionStatus: 'Pending',
      subscriptionStartDate: new Date().toISOString().slice(0, 10),
      subscriptionExpiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      accountStatus: 'active',
    });
    setModalOpen(true);
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    reset({
      name: org.name,
      type: org.type,
      contactPerson: org.contactPerson,
      email: org.email,
      phone: org.phone,
      address: org.address,
      adminLoginEmail: org.adminLoginEmail,
      adminLoginId: org.adminLoginId || '',
      subscriptionPlanId: org.subscriptionPlanId || '',
      subscriptionStatus: org.subscriptionStatus,
      subscriptionStartDate: org.subscriptionStartDate || '',
      subscriptionExpiryDate: org.subscriptionExpiryDate || '',
      accountStatus: org.accountStatus,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: OrgFormValues) => {
    if (!userProfile) return;
    const selectedPlan = plans.find((p) => p.id === values.subscriptionPlanId);

    try {
      if (editingOrg) {
        await updateOrganization(
          editingOrg.id,
          {
            ...values,
            subscriptionPlanName: selectedPlan?.name || editingOrg.subscriptionPlanName || '',
          },
          userProfile
        );
        showToast('Organization updated', 'success', `${values.name} saved to Firestore.`);
      } else {
        await createOrganization(
          {
            name: values.name,
            type: values.type as OrganizationType,
            contactPerson: values.contactPerson,
            email: values.email,
            phone: values.phone,
            address: values.address,
            adminLoginEmail: values.adminLoginEmail,
            adminLoginId: values.adminLoginId?.trim() || undefined,
            subscriptionPlanId: values.subscriptionPlanId,
            subscriptionPlanName: selectedPlan?.name || 'Custom',
            subscriptionStatus: values.subscriptionStatus,
            subscriptionStartDate: values.subscriptionStartDate,
            subscriptionExpiryDate: values.subscriptionExpiryDate,
            accountStatus: values.accountStatus,
          },
          userProfile
        );
        showToast(
          'Organization provisioned',
          'success',
          `${values.name} and admin invite (${values.adminLoginEmail}) created.`
        );
      }
      setModalOpen(false);
      setDemoPreview(false);
      await loadData();
    } catch (err) {
      showToast('Save failed', 'error', err instanceof Error ? err.message : 'Operation denied');
    }
  };

  const handleSendAdminInvite = async (org: Organization) => {
    try {
      const msg = await issuePasswordSetupInvite(org.adminLoginEmail);
      showToast('Password invite dispatched', 'success', msg);
    } catch (err) {
      showToast('Invite failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setDeleting(true);
    try {
      await deleteOrganization(deleteTarget.id, deleteTarget.name, userProfile);
      showToast('Organization deleted', 'success', `${deleteTarget.name} removed.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Registered Organizations Report',
      subtitle: demoPreview ? 'Source: Visual Preview Demo Data' : 'Source: Live Firestore Database',
      generatedBy: userProfile?.email || 'Super Admin',
      columns: ['Organization', 'Type', 'Contact Person', 'Admin Login', 'Plan', 'Sub Status', 'Account'],
      rows: filteredData.map((o) => [
        o.name,
        o.type,
        o.contactPerson,
        o.adminLoginEmail,
        o.subscriptionPlanName || 'Unassigned',
        o.subscriptionStatus,
        o.accountStatus,
      ]),
      filename: 'rexon-organizations-report',
    });
  };

  const columns: ColumnDef<Organization>[] = [
    {
      key: 'name',
      header: 'Organization Name',
      sortable: true,
      sortValue: (o) => o.name,
      render: (o) => (
        <div>
          <p className="font-semibold text-slate-900">{o.name}</p>
          <p className="text-xs text-slate-500">{o.adminLoginEmail}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (o) => o.type,
      render: (o) => <span className="text-slate-700">{o.type}</span>,
    },
    {
      key: 'contact',
      header: 'Contact Person',
      render: (o) => (
        <div>
          <p className="text-slate-800">{o.contactPerson}</p>
          <p className="text-xs text-slate-500">{o.phone}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan & Expiry',
      render: (o) => (
        <div>
          <p className="font-medium text-slate-800">{o.subscriptionPlanName || '—'}</p>
          <p className="text-xs text-slate-500 tabular-nums">
            {o.subscriptionExpiryDate || 'No expiry set'}
          </p>
        </div>
      ),
    },
    {
      key: 'subStatus',
      header: 'Subscription',
      render: (o) => <StatusLabel status={o.subscriptionStatus} />,
    },
    {
      key: 'accountStatus',
      header: 'Status',
      render: (o) => <StatusLabel status={o.accountStatus} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (o) =>
        demoPreview ? (
          <span className="text-xs text-slate-400">Preview only</span>
        ) : (
          <div className="inline-flex items-center gap-1.5">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => openEditModal(o)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1D4ED8]"
                  title="Edit organization"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendAdminInvite(o)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-[#1D4ED8]"
                  title="Send password setup / reset invite"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteTarget(o)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                title="Delete organization"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
    },
  ];

  return (
    <DashboardLayout
      title="Organization Management"
      subtitle="Provision and govern isolated multi-tenant workspaces for companies, factories, societies, and industries."
      actions={
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Create Organization</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={organizations.length}
          label="organizations"
        />

        <DataTable
          data={filteredData}
          columns={columns}
          rowKey={(o) => o.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization, contact, or admin email..."
          filters={[
            {
              key: 'type',
              label: 'Filter by organization type',
              value: typeFilter,
              onChange: setTypeFilter,
              options: [
                { label: 'All Types', value: 'all' },
                { label: 'Company', value: 'Company' },
                { label: 'Factory', value: 'Factory' },
                { label: 'Society', value: 'Society' },
                { label: 'Apartment', value: 'Apartment' },
                { label: 'Commercial Building', value: 'Commercial Building' },
                { label: 'Industry', value: 'Industry' },
                { label: 'Other', value: 'Other' },
              ],
            },
            {
              key: 'status',
              label: 'Filter by status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { label: 'All Statuses', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Pending', value: 'pending' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Disabled', value: 'disabled' },
              ],
            },
          ]}
          emptyTitle="No organizations provisioned yet"
          emptyDescription="Create your first company, factory, or residential society tenant workspace to begin."
          emptyAction={
            canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Create First Organization
              </button>
            )
          }
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingOrg ? 'Edit Organization' : 'Create Organization'}
        subtitle="Creating an organization provisions an isolated tenant boundary and pre-authorizes its Organization Admin email."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Organization Name *
              </label>
              <input
                type="text"
                {...register('name')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Organization Type *
              </label>
              <select
                {...register('type')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
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
                {...register('contactPerson')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.contactPerson && (
                <p className="mt-1 text-xs text-rose-600">{errors.contactPerson.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Phone *</label>
              <input
                type="text"
                {...register('phone')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Organization Contact Email *
              </label>
              <input
                type="email"
                {...register('email')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Organization Admin Login Email *
              </label>
              <input
                type="email"
                {...register('adminLoginEmail')}
                placeholder="admin@tenant-org.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.adminLoginEmail && (
                <p className="mt-1 text-xs text-rose-600">{errors.adminLoginEmail.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Admin Login ID (Optional)
              </label>
              <input
                type="text"
                {...register('adminLoginId')}
                placeholder="e.g. apex.admin"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Address *</label>
              <input
                type="text"
                {...register('address')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.address && (
                <p className="mt-1 text-xs text-rose-600">{errors.address.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Subscription Plan
              </label>
              <select
                {...register('subscriptionPlanId')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              >
                <option value="">Select plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.yearlyPrice}/yr)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Subscription Status
              </label>
              <select
                {...register('subscriptionStatus')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              >
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Suspended">Suspended</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Start Date</label>
              <input
                type="date"
                {...register('subscriptionStartDate')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Expiry Date</label>
              <input
                type="date"
                {...register('subscriptionExpiryDate')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Account Status</label>
              <select
                {...register('accountStatus')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
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
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : editingOrg ? 'Save Changes' : 'Create Organization'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete Organization"
        message={`Are you sure you want to permanently remove "${deleteTarget?.name}"? Associated tenant access will stop functioning.`}
        confirmLabel="Delete Organization"
      />
    </DashboardLayout>
  );
}
