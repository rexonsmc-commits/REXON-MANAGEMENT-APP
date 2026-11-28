import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Edit2, Eye, EyeOff, KeyRound, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import {
  generateStrongPassword,
  LoginCredentialsModal,
} from '../../components/common/LoginCredentialsModal';
import { PdfExportModal, PdfFilterValues } from '../../components/common/PdfExportModal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  provisionFirebaseAuthCredentials,
  syncProvisionedAccountProfile,
} from '../../services/auth/authService';
import {
  createOrganization,
  deleteOrganization,
  listOrganizations,
  setOrganizationHiddenState,
  updateOrganization,
} from '../../services/organizations/organizationService';
import {
  listAllSubscriptionPlans,
  listPublicSubscriptionPlans,
} from '../../services/subscriptions/subscriptionService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Organization, OrganizationType, SubscriptionPlan } from '../../types';
import { DEMO_ORGANIZATIONS, SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';
import {
  formatDisplayDate,
  formatINR,
  getSubscriptionExpiryInfo,
  matchesDateFilter,
  sortOrganizationsByExpiry,
} from '../../utils/subscriptionHelpers';

const orgSchema = z.object({
  name: z.string().min(2, 'Company / Society name required').max(160),
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

interface CredentialsModalState {
  open: boolean;
  orgId?: string;
  targetName: string;
  email: string;
  loginId?: string;
  initialPassword?: string;
  authStatusMessage?: string;
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const {
    userProfile,
    realUserProfile,
    firebaseUser,
    hasPermission,
    isSuperAdmin,
  } = useAuth();
  const { showToast } = useToast();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingHideId, setTogglingHideId] = useState<string | null>(null);

  // Firebase Auth credential provisioning on create
  const [createAuthCredentials, setCreateAuthCredentials] = useState(true);
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<CredentialsModalState>({
    open: false,
    targetName: '',
    email: '',
  });

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
    if (!userProfile || !firebaseUser) return;
    setLoading(true);
    try {
      const canListAllPlans =
        userProfile.role === 'super_admin' ||
        hasPermission('manage_plans') ||
        hasPermission('view_payments');
      const [orgsData, plansData] = await Promise.all([
        listOrganizations(),
        (canListAllPlans ? listAllSubscriptionPlans() : listPublicSubscriptionPlans()).catch(
          () => []
        ),
      ]);
      setOrganizations(orgsData);
      if (plansData.length > 0) setPlans(plansData);
    } catch (err) {
      showToast('Failed to load organizations', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [showToast, userProfile, firebaseUser, hasPermission]);

  useEffect(() => {
    if (!userProfile || !firebaseUser) return;
    void loadData();
  }, [loadData, userProfile, firebaseUser]);

  const activeDataset = useMemo(
    () => sortOrganizationsByExpiry(demoPreview ? DEMO_ORGANIZATIONS : organizations),
    [demoPreview, organizations]
  );

  const filteredData = useMemo(() => {
    return activeDataset.filter((o) => {
      const matchesSearch =
        !search.trim() ||
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        o.adminLoginEmail.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || o.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'hidden' ? Boolean(o.isHidden) : o.accountStatus === statusFilter);
      const info = getSubscriptionExpiryInfo(o);
      const matchesExpiry =
        expiryFilter === 'all' ||
        (expiryFilter === 'attention' && info.isAlertRequired) ||
        (expiryFilter === 'healthy' && !info.isAlertRequired);
      return matchesSearch && matchesType && matchesStatus && matchesExpiry;
    });
  }, [activeDataset, search, typeFilter, statusFilter, expiryFilter]);

  const openCreateModal = () => {
    setEditingOrg(null);
    setCreateAuthCredentials(true);
    setInitialPassword('');
    setShowInitialPassword(false);
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
      subscriptionStatus: 'Active',
      subscriptionStartDate: new Date().toISOString().slice(0, 10),
      subscriptionExpiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      accountStatus: 'active',
    });
    setModalOpen(true);
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setCreateAuthCredentials(false);
    setInitialPassword('');
    setShowInitialPassword(false);
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

  const openCredentialsModalForOrg = (org: Organization) => {
    setCredentialsModal({
      open: true,
      orgId: org.id,
      targetName: org.name,
      email: org.adminLoginEmail,
      loginId: org.adminLoginId,
    });
  };

  const onSubmit = async (values: OrgFormValues) => {
    if (!userProfile) return;
    if (!editingOrg && createAuthCredentials && initialPassword.trim().length < 6) {
      showToast(
        'Password required',
        'error',
        'Enter a login password of at least 6 characters to save credentials in Firebase Authentication.'
      );
      return;
    }

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
        showToast('Company / Society updated', 'success', `${values.name} saved to Firestore.`);
        setModalOpen(false);
      } else {
        const createdOrg = await createOrganization(
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

        let authStatusMessage =
          'Tenant record and admin invite provisioned in Firestore. Use the Login Credentials modal anytime to set or reset the password.';
        let provisionedPassword: string | undefined;

        if (createAuthCredentials && initialPassword.trim().length >= 6) {
          const authRes = await provisionFirebaseAuthCredentials({
            email: values.adminLoginEmail,
            password: initialPassword.trim(),
            displayName: values.contactPerson,
          });
          authStatusMessage = authRes.message;
          if (authRes.status === 'created') {
            provisionedPassword = initialPassword.trim();
            if (authRes.uid) {
              await Promise.all([
                updateOrganization(
                  createdOrg.id,
                  { adminUid: authRes.uid },
                  userProfile
                ).catch(() => undefined),
                syncProvisionedAccountProfile({
                  uid: authRes.uid,
                  email: values.adminLoginEmail,
                }),
              ]);
            }
          }
        }

        showToast(
          'Company / Society created',
          'success',
          `${values.name} provisioned for ${values.adminLoginEmail}.`
        );
        setModalOpen(false);
        setCredentialsModal({
          open: true,
          orgId: createdOrg.id,
          targetName: values.name,
          email: values.adminLoginEmail.trim().toLowerCase(),
          loginId: values.adminLoginId?.trim() || undefined,
          initialPassword: provisionedPassword,
          authStatusMessage,
        });
      }
      setDemoPreview(false);
      await loadData();
    } catch (err) {
      showToast('Save failed', 'error', err instanceof Error ? err.message : 'Operation denied');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setDeleting(true);
    try {
      await deleteOrganization(
        deleteTarget.id,
        deleteTarget.name,
        realUserProfile || userProfile
      );
      showToast('Company / Society deleted', 'success', `${deleteTarget.name} removed.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDetails = (org: Organization) => {
    if (!isSuperAdmin()) return;
    navigate(`/organization-admin/dashboard?orgId=${encodeURIComponent(org.id)}`, {
      state: { inspectOrg: org },
    });
  };

  const handleToggleHide = async (org: Organization) => {
    if (!isSuperAdmin() || !userProfile) return;
    const nextHidden = !org.isHidden;
    setTogglingHideId(org.id);
    try {
      await setOrganizationHiddenState(
        org.id,
        org.name,
        nextHidden,
        realUserProfile || userProfile
      );
      showToast(
        nextHidden ? 'Company / Society hidden' : 'Company / Society unhidden',
        'success',
        nextHidden
          ? `${org.name} is hidden. Company / Society users will see a contact Super Admin notice.`
          : `${org.name} portal access restored for company / society users.`
      );
      await loadData();
    } catch (err) {
      showToast('Status update failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setTogglingHideId(null);
    }
  };

  const filterOrgsForPdf = (filters: PdfFilterValues) => {
    return activeDataset.filter((o) => {
      const dateRef = o.subscriptionStartDate || o.createdAt || o.subscriptionExpiryDate;
      if (filters.dateFilter.mode !== 'all' && !matchesDateFilter(dateRef, filters.dateFilter)) {
        return false;
      }
      if (filters.companyId !== 'all' && o.id !== filters.companyId) {
        return false;
      }
      if (filters.extraFilter !== 'all' && o.subscriptionStatus !== filters.extraFilter) {
        return false;
      }
      return true;
    });
  };

  const handleExportPdf = (filters: PdfFilterValues, filterSummary: string) => {
    const rowsData = filterOrgsForPdf(filters);
    exportTableToPdf({
      title: 'Registered Companies & Societies Report',
      subtitle: `${demoPreview ? 'Demo Preview' : 'Live Firestore'}  |  ${filterSummary}`,
      generatedBy: userProfile?.email || 'Super Admin',
      columns: [
        'Company / Society',
        'Type',
        'Contact Person',
        'Admin Login',
        'Plan',
        'Expiry',
        'Sub Status',
        'Created',
      ],
      rows: rowsData.map((o) => [
        o.name,
        o.type,
        o.contactPerson,
        o.adminLoginEmail,
        o.subscriptionPlanName || 'Unassigned',
        o.subscriptionExpiryDate || '—',
        o.subscriptionStatus,
        formatDisplayDate(o.createdAt || o.subscriptionStartDate),
      ]),
      filename: 'rexon-companies-societies-report',
    });
  };

  const columns: ColumnDef<Organization>[] = [
    {
      key: 'name',
      header: 'Company / Society Name',
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
      render: (o) => {
        const info = getSubscriptionExpiryInfo(o);
        return (
          <div>
            <p className="font-medium text-slate-800">{o.subscriptionPlanName || '—'}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
              <span className="text-slate-500">{o.subscriptionExpiryDate || 'No expiry set'}</span>
              {info.urgency === 'expired' && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                  {info.label}
                </span>
              )}
              {info.urgency === 'expiring_soon' && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                  {info.label}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'subStatus',
      header: 'Subscription',
      render: (o) => <StatusLabel status={o.subscriptionStatus} />,
    },
    {
      key: 'accountStatus',
      header: 'Status',
      render: (o) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusLabel status={o.accountStatus} />
          {o.isHidden && (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
              Hidden
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions & Portal Access',
      align: 'right',
      render: (o) =>
        demoPreview ? (
          <span className="text-xs text-slate-400">Preview only</span>
        ) : (
          <div className="ml-auto flex w-[160px] flex-col items-stretch gap-1.5">
            {isSuperAdmin() && (
              <>
                <button
                  type="button"
                  onClick={() => handleViewDetails(o)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                  title="Open full Company / Society Admin portal directly without password"
                >
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                  <span>View Details</span>
                </button>
                <button
                  type="button"
                  disabled={togglingHideId === o.id}
                  onClick={() => void handleToggleHide(o)}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${
                    o.isHidden
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                  title={
                    o.isHidden
                      ? 'Unhide Company / Society so users can log in again'
                      : 'Hide Company / Society and block tenant user logins'
                  }
                >
                  {o.isHidden ? (
                    <>
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      <span>{togglingHideId === o.id ? 'Updating...' : 'Unhide'}</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 shrink-0" />
                      <span>{togglingHideId === o.id ? 'Updating...' : 'Hide'}</span>
                    </>
                  )}
                </button>
              </>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openCredentialsModalForOrg(o)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-100 whitespace-nowrap"
                title="Login ID, Password & Dashboard Login Link"
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span>Login ID &amp; Pass</span>
              </button>
            )}
            {(canEdit || canDelete) && (
              <div className="grid grid-cols-2 gap-1.5">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => openEditModal(o)}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1D4ED8] whitespace-nowrap"
                    title="Edit company / society"
                  >
                    <Edit2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <span />
                )}
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(o)}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
                    title="Delete company / society and associated tenant access"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        ),
    },
  ];

  return (
    <DashboardLayout
      title="Company / Society Management"
      subtitle="Provision and govern isolated multi-tenant workspaces and login credentials for companies, societies, factories, and industries."
      actions={
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={() => setPdfModalOpen(true)}
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
              <span>Create Company / Society</span>
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
          label="companies & societies"
        />

        <DataTable
          data={filteredData}
          columns={columns}
          rowKey={(o) => o.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search company, society, contact, or admin email..."
          filters={[
            {
              key: 'type',
              label: 'Filter by type',
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
              key: 'expiry',
              label: 'Subscription Priority',
              value: expiryFilter,
              onChange: setExpiryFilter,
              options: [
                { label: 'All Subscriptions (Expiring First)', value: 'all' },
                { label: 'Expiring Soon / Expired / Pending', value: 'attention' },
                { label: 'Healthy Active (>30d)', value: 'healthy' },
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
                { label: 'Hidden', value: 'hidden' },
                { label: 'Pending', value: 'pending' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Disabled', value: 'disabled' },
              ],
            },
          ]}
          emptyTitle="No companies or societies provisioned yet"
          emptyDescription="Create your first company, society, or factory workspace with login ID and password access."
          emptyAction={
            canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Create First Company / Society
              </button>
            )
          }
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingOrg ? 'Edit Company / Society' : 'Create Company / Society'}
        subtitle="Creates an isolated tenant dashboard and provisions login credentials in Firebase Authentication."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Company / Society Name *
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
                Category / Type *
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
                Company / Society Contact Email *
              </label>
              <input
                type="email"
                {...register('email')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
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

          {/* Login ID & Password Provisioning Link */}
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#1D4ED8]" />
                <span className="text-xs font-bold text-slate-900">
                  Login ID &amp; Password Link (Firebase Authentication)
                </span>
              </div>
              {editingOrg ? (
                <button
                  type="button"
                  onClick={() => openCredentialsModalForOrg(editingOrg)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-blue-50"
                >
                  <Link2 className="h-3 w-3" />
                  <span>Open Login Link &amp; Password Setup</span>
                </button>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={createAuthCredentials}
                    onChange={(e) => setCreateAuthCredentials(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>Save Login ID &amp; Password to Firebase Auth now</span>
                </label>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Admin Login Email (Login ID) *
                </label>
                <input
                  type="email"
                  {...register('adminLoginEmail')}
                  placeholder="admin@company-or-society.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                />
                {errors.adminLoginEmail && (
                  <p className="mt-1 text-xs text-rose-600">{errors.adminLoginEmail.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Short Login ID (Optional)
                </label>
                <input
                  type="text"
                  {...register('adminLoginId')}
                  placeholder="e.g. apex.society"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            {!editingOrg && createAuthCredentials && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Initial Login Password * (min 6 chars)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setInitialPassword(generateStrongPassword());
                      setShowInitialPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D4ED8] hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Generate Password</span>
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    type={showInitialPassword ? 'text' : 'password'}
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder="Set password for Company / Society dashboard login"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showInitialPassword ? 'Hide password' : 'Show password'}
                  >
                    {showInitialPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Saved directly in Firebase Authentication without disturbing your Super Admin session.
                </p>
              </div>
            )}
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
                    {p.name} ({formatINR(p.yearlyPrice)}/yr)
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
              {isSubmitting ? 'Saving...' : editingOrg ? 'Save Changes' : 'Create Company / Society'}
            </button>
          </div>
        </form>
      </Modal>

      <LoginCredentialsModal
        open={credentialsModal.open}
        onClose={() =>
          setCredentialsModal((prev) => ({
            ...prev,
            open: false,
            initialPassword: undefined,
            authStatusMessage: undefined,
          }))
        }
        entityLabel="Company / Society Admin"
        targetName={credentialsModal.targetName}
        email={credentialsModal.email}
        loginId={credentialsModal.loginId}
        initialPassword={credentialsModal.initialPassword}
        authStatusMessage={credentialsModal.authStatusMessage}
        onAuthProvisioned={async (uid) => {
          if (credentialsModal.orgId && userProfile) {
            await Promise.all([
              updateOrganization(credentialsModal.orgId, { adminUid: uid }, userProfile).catch(
                () => undefined
              ),
              syncProvisionedAccountProfile({
                uid,
                email: credentialsModal.email,
              }),
            ]);
            await loadData();
          }
        }}
      />

      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Export Companies & Societies PDF"
        companies={activeDataset.map((o) => ({ id: o.id, name: o.name }))}
        extraFilterLabel="Subscription Status"
        extraFilterOptions={[
          { label: 'All Subscription Statuses', value: 'all' },
          { label: 'Active', value: 'Active' },
          { label: 'Pending', value: 'Pending' },
          { label: 'Expired', value: 'Expired' },
          { label: 'Suspended', value: 'Suspended' },
        ]}
        getMatchCount={(f) => filterOrgsForPdf(f).length}
        onExport={handleExportPdf}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete Company / Society"
        message={`Are you sure you want to permanently remove "${deleteTarget?.name}"? Associated tenant access will stop functioning.`}
        confirmLabel="Delete Company / Society"
      />
    </DashboardLayout>
  );
}
