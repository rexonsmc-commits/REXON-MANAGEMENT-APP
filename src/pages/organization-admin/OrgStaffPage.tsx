import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import {
  generateStrongPassword,
  LoginCredentialsModal,
} from '../../components/common/LoginCredentialsModal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import {
  EXAMPLE_ORG_DEPARTMENTS,
  ORG_STAFF_PERMISSIONS,
} from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  provisionFirebaseAuthCredentials,
  syncProvisionedAccountProfile,
} from '../../services/auth/authService';
import {
  createOrganizationStaff,
  createRoleTemplate,
  deleteOrganizationStaff,
  deleteRoleTemplate,
  listOrganizationStaff,
  listRoleTemplates,
  updateOrganizationStaff,
} from '../../services/staff/staffService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import {
  AccountStatus,
  OrganizationStaff,
  OrgStaffPermissionKey,
  RoleTemplate,
} from '../../types';
import { DEMO_ORG_STAFF } from '../../utils/demoData';

interface CredentialsModalState {
  open: boolean;
  staffId?: string;
  targetName: string;
  email: string;
  loginId?: string;
  initialPassword?: string;
  authStatusMessage?: string;
}

export function OrgStaffPage() {
  const { userProfile, organization, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [staffList, setStaffList] = useState<OrganizationStaff[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationStaff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationStaff | null>(null);
  const [saving, setSaving] = useState(false);

  // Staff form state
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Security');
  const [roleName, setRoleName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [permissions, setPermissions] = useState<OrgStaffPermissionKey[]>(['view_dashboard']);

  // Firebase Auth Login ID & Password provisioning
  const [createAuthCredentials, setCreateAuthCredentials] = useState(true);
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<CredentialsModalState>({
    open: false,
    targetName: '',
    email: '',
  });

  // Role Template builder state (merged inside Staff Management)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleTplName, setRoleTplName] = useState('');
  const [roleTplDesc, setRoleTplDesc] = useState('');
  const [roleTplPerms, setRoleTplPerms] = useState<OrgStaffPermissionKey[]>(['view_dashboard']);
  const [savingRole, setSavingRole] = useState(false);

  const orgId = userProfile?.organizationId || '';
  const isOrgAdmin = userProfile?.role === 'organization_admin';
  const isOrgStaff = userProfile?.role === 'organization_staff';
  const canManage = isOrgAdmin || hasPermission('manage_staff');
  const canExport = isOrgAdmin || hasPermission('export_pdf');

  const activeTab: 'staff' | 'roles' =
    canManage && searchParams.get('tab') === 'roles' ? 'roles' : 'staff';

  const setActiveTab = (tab: 'staff' | 'roles') => {
    if (tab === 'roles') {
      setSearchParams({ tab: 'roles' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const loadData = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [staff, roles] = await Promise.all([
        listOrganizationStaff(orgId),
        listRoleTemplates(orgId).catch(() => []),
      ]);
      setStaffList(staff);
      setRoleTemplates(roles);
    } catch (err) {
      showToast('Failed to load staff', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Organization staff must never preview demo records from another sample society
  const effectiveDemo = !isOrgStaff && demoPreview;
  const activeData = effectiveDemo ? DEMO_ORG_STAFF : staffList;

  const departments = useMemo(() => {
    const set = new Set([...EXAMPLE_ORG_DEPARTMENTS, ...activeData.map((s) => s.department)]);
    return Array.from(set);
  }, [activeData]);

  const filtered = useMemo(() => {
    return activeData.filter((s) => {
      const matchesSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.employeeId.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === 'all' || s.department === deptFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [activeData, search, deptFilter, statusFilter]);

  const openAdd = (presetRole?: RoleTemplate) => {
    setEditing(null);
    setEmployeeId(`EMP-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setEmail('');
    setPhone('');
    setLoginId('');
    setDesignation('');
    setDepartment('Security');
    setRoleName(presetRole ? presetRole.name : 'Staff Member');
    setSelectedTemplateId(presetRole ? presetRole.id : '');
    setStatus('active');
    setPermissions(presetRole ? [...presetRole.permissions] : ['view_dashboard', 'view_properties']);
    setCreateAuthCredentials(true);
    setInitialPassword('');
    setShowInitialPassword(false);
    setModalOpen(true);
  };

  const openEdit = (s: OrganizationStaff) => {
    setEditing(s);
    setEmployeeId(s.employeeId);
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone || '');
    setLoginId(s.loginId || '');
    setDesignation(s.designation);
    setDepartment(s.department);
    setRoleName(s.role);
    setSelectedTemplateId('');
    setStatus(s.status);
    setPermissions(s.permissions);
    setCreateAuthCredentials(false);
    setInitialPassword('');
    setShowInitialPassword(false);
    setModalOpen(true);
  };

  const openCredentialsModalForStaff = (s: OrganizationStaff) => {
    setCredentialsModal({
      open: true,
      staffId: s.id,
      targetName: s.name,
      email: s.email,
      loginId: s.loginId,
    });
  };

  const applyRoleTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = roleTemplates.find((r) => r.id === templateId);
    if (!tpl) return;
    setRoleName(tpl.name);
    setPermissions(tpl.permissions);
  };

  const togglePerm = (key: OrgStaffPermissionKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleRoleTplPerm = (key: OrgStaffPermissionKey) => {
    setRoleTplPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId) return;

    if (!name.trim() || !email.trim() || !employeeId.trim() || !designation.trim()) {
      showToast(
        'Missing required fields',
        'error',
        'Employee ID, name, email, and designation are required.'
      );
      return;
    }

    if (!editing && createAuthCredentials && initialPassword.trim().length < 6) {
      showToast(
        'Password required',
        'error',
        'Enter a login password of at least 6 characters to save credentials in Firebase Authentication.'
      );
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateOrganizationStaff(
          editing.id,
          {
            employeeId,
            name,
            email,
            phone: phone.trim() || undefined,
            loginId: loginId.trim() || undefined,
            designation,
            department,
            role: roleName,
            permissions,
            status,
          },
          userProfile
        );
        showToast('Staff record updated', 'success', name);
        setModalOpen(false);
      } else {
        const createdStaff = await createOrganizationStaff(
          {
            organizationId: orgId,
            employeeId,
            name,
            email,
            phone: phone.trim() || undefined,
            loginId: loginId.trim() || undefined,
            designation,
            department,
            role: roleName,
            permissions,
            status,
          },
          userProfile,
          organization?.name || userProfile.organizationName
        );

        let authStatusMessage =
          'Staff account created in your company/society. Use the Login Credentials dialog anytime to set or reset the password.';
        let provisionedPassword: string | undefined;

        if (createAuthCredentials && initialPassword.trim().length >= 6) {
          const authRes = await provisionFirebaseAuthCredentials({
            email,
            password: initialPassword.trim(),
            displayName: name,
          });
          authStatusMessage = authRes.message;
          if (authRes.status === 'created') {
            provisionedPassword = initialPassword.trim();
            if (authRes.uid) {
              await Promise.all([
                updateOrganizationStaff(
                  createdStaff.id,
                  { uid: authRes.uid },
                  userProfile
                ).catch(() => undefined),
                syncProvisionedAccountProfile({
                  uid: authRes.uid,
                  email,
                }),
              ]);
            }
          }
        }

        showToast(
          'Staff member provisioned',
          'success',
          `${name} can now sign in with ${email}.`
        );
        setModalOpen(false);
        setCredentialsModal({
          open: true,
          staffId: createdStaff.id,
          targetName: name.trim(),
          email: email.trim().toLowerCase(),
          loginId: loginId.trim() || undefined,
          initialPassword: provisionedPassword,
          authStatusMessage,
        });
      }
      setDemoPreview(false);
      await loadData();
    } catch (err) {
      showToast('Save failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (s: OrganizationStaff) => {
    if (!userProfile) return;
    const next: AccountStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      await updateOrganizationStaff(s.id, { status: next }, userProfile);
      showToast(`Staff marked ${next}`, 'success', s.name);
      await loadData();
    } catch (err) {
      showToast('Status update failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setSaving(true);
    try {
      await deleteOrganizationStaff(deleteTarget.id, orgId, deleteTarget.name, userProfile);
      showToast('Staff deleted', 'success', deleteTarget.name);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId || !roleTplName.trim()) return;
    setSavingRole(true);
    try {
      await createRoleTemplate(
        {
          organizationId: orgId,
          name: roleTplName.trim(),
          description: roleTplDesc.trim(),
          permissions: roleTplPerms,
        },
        userProfile
      );
      showToast('Role template created', 'success', roleTplName.trim());
      setRoleModalOpen(false);
      setRoleTplName('');
      setRoleTplDesc('');
      setRoleTplPerms(['view_dashboard']);
      await loadData();
    } catch (err) {
      showToast('Failed to create role', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!userProfile || !orgId) return;
    try {
      await deleteRoleTemplate(roleId, orgId, userProfile);
      showToast('Role template removed', 'success');
      await loadData();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  const handleExport = () => {
    exportTableToPdf({
      title: 'Organization Staff Directory',
      organizationName: organization?.name || userProfile?.organizationName,
      generatedBy: userProfile?.email || 'Organization Admin',
      columns: ['Emp ID', 'Name', 'Email', 'Department', 'Designation', 'Role', 'Status'],
      rows: filtered.map((s) => [
        s.employeeId,
        s.name,
        s.email,
        s.department,
        s.designation,
        s.role,
        s.status,
      ]),
      filename: 'rexon-organization-staff',
    });
  };

  const columns: ColumnDef<OrganizationStaff>[] = [
    {
      key: 'empId',
      header: 'Employee ID',
      sortable: true,
      sortValue: (s) => s.employeeId,
      render: (s) => (
        <span className="font-mono text-xs font-semibold text-slate-800">{s.employeeId}</span>
      ),
    },
    {
      key: 'name',
      header: 'Employee Name',
      sortable: true,
      sortValue: (s) => s.name,
      render: (s) => (
        <div>
          <p className="font-semibold text-slate-900">{s.name}</p>
          <p className="text-xs text-slate-500">{s.email}</p>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Department & Role',
      render: (s) => (
        <div>
          <p className="font-medium text-slate-800">
            {s.department} · {s.role}
          </p>
          <p className="text-xs text-slate-500">{s.designation}</p>
        </div>
      ),
    },
    {
      key: 'perms',
      header: 'Permissions',
      render: (s) => (
        <span className="font-mono text-xs text-slate-700 tabular-nums">
          {s.permissions.length} assigned
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <StatusLabel status={s.status} />,
    },
    {
      key: 'actions',
      header: 'Login Access & Actions',
      align: 'right',
      render: (s) =>
        effectiveDemo || !canManage ? (
          <span className="text-xs text-slate-400">
            {effectiveDemo ? 'Preview only' : 'View only'}
          </span>
        ) : (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openCredentialsModalForStaff(s)}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-blue-100"
              title="Login ID, Password & Dashboard Login Link"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Login ID &amp; Pass</span>
            </button>
            <button
              type="button"
              onClick={() => openEdit(s)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1D4ED8]"
              title="Edit staff"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleToggleStatus(s)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
              title="Toggle Active/Inactive"
            >
              <Power className="h-4 w-4" />
            </button>
            {isOrgAdmin && (
              <button
                type="button"
                onClick={() => setDeleteTarget(s)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                title="Delete staff"
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
      title="Staff, Roles & Permissions Management"
      subtitle={`Manage staff accounts, login credentials, custom roles, and strict module permissions for ${
        organization?.name || userProfile?.organizationName || 'your organization'
      }.`}
      actions={
        <div className="flex items-center gap-2">
          {activeTab === 'staff' && canExport && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          )}
          {canManage && activeTab === 'roles' && (
            <button
              type="button"
              onClick={() => setRoleModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>New Role Template</span>
            </button>
          )}
          {canManage && activeTab === 'staff' && (
            <button
              type="button"
              onClick={() => openAdd()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {canManage && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'staff'
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Staff Directory ({staffList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('roles')}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'roles'
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Roles &amp; Permissions ({roleTemplates.length})</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {activeTab === 'staff'
                ? 'Staff accounts only see modules you permit within this organization.'
                : 'Define reusable role permission bundles and apply them directly when adding staff.'}
            </p>
          </div>
        )}

        {activeTab === 'staff' ? (
          <>
            {!isOrgStaff && (
              <DemoDataBanner
                isDemoMode={demoPreview}
                onToggleDemo={() => setDemoPreview((p) => !p)}
                liveCount={staffList.length}
                label="staff members"
              />
            )}

            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(s) => s.id}
              loading={loading}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search employee ID, name, or email..."
              filters={[
                {
                  key: 'dept',
                  label: 'Department',
                  value: deptFilter,
                  onChange: setDeptFilter,
                  options: [
                    { label: 'All Departments', value: 'all' },
                    ...departments.map((d) => ({ label: d, value: d })),
                  ],
                },
                {
                  key: 'status',
                  label: 'Status',
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
              emptyTitle="No organization staff added yet"
              emptyDescription="Add employees, guards, receptionists, or managers with Login ID, Password, and module permissions."
              emptyAction={
                canManage && (
                  <button
                    type="button"
                    onClick={() => openAdd()}
                    className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                  >
                    Add First Staff Member
                  </button>
                )
              }
            />
          </>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : roleTemplates.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#1D4ED8]" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              No Custom Role Templates Defined
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Create reusable templates (e.g., Gate Supervisor, Reception Coordinator, Estate
              Manager) to apply consistent permissions when onboarding staff.
            </p>
            <button
              type="button"
              onClick={() => setRoleModalOpen(true)}
              className="mt-5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
            >
              Create First Role Template
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {roleTemplates.map((r) => (
              <div
                key={r.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-slate-900">{r.name}</h2>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRole(r.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs text-slate-500">{r.description}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {r.permissions.map((p) => {
                      const def = ORG_STAFF_PERMISSIONS.find((d) => d.key === p);
                      return (
                        <span
                          key={p}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {def?.label || p}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('staff');
                      openAdd(r);
                    }}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-100"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add Staff with This Role</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Organization Staff Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Organization Staff' : 'Add Organization Staff'}
        subtitle="Provisions staff login credentials in Firebase Authentication strictly scoped to your company/society."
        maxWidth="xl"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Employee ID *</label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Employee Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98000 00000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Designation *</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Department (customizable) *
              </label>
              <input
                type="text"
                list="org-dept-suggestions"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
              <datalist id="org-dept-suggestions">
                {EXAMPLE_ORG_DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Role Label *</label>
              <input
                type="text"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
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
              {editing ? (
                <button
                  type="button"
                  onClick={() => openCredentialsModalForStaff(editing)}
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
                  Staff Login Email (Login ID) *
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editing)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@company.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Short Login ID (Optional)
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. sec.supervisor"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            {!editing && createAuthCredentials && (
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
                    placeholder="Set password for Staff dashboard login"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showInitialPassword ? 'Hide password' : 'Show password'}
                  >
                    {showInitialPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Saved directly in Firebase Authentication without disturbing your admin session.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Apply Saved Role Template (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setActiveTab('roles');
                    setRoleModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-[#1D4ED8] hover:underline"
                >
                  + Create Role Template
                </button>
              </div>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyRoleTemplate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Choose a role preset...</option>
                {roleTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.permissions.length} perms)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AccountStatus)}
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

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Module Permissions ({permissions.length} selected)
              </label>
              <span className="text-[11px] text-slate-500">
                Enforced both in sidebar navigation and Firestore rules
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ORG_STAFF_PERMISSIONS.map((perm) => {
                const checked = permissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs ${
                      checked ? 'border-[#1D4ED8] bg-blue-50/50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePerm(perm.key)}
                      className="mt-0.5 rounded border-slate-300 text-[#1D4ED8]"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{perm.label}</p>
                      <p className="text-slate-500">{perm.description}</p>
                    </div>
                  </label>
                );
              })}
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
              disabled={saving}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Save Staff Changes' : 'Create Staff Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Role Template Modal (Merged inside Staff Management) */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title="Create Role Template"
        subtitle="Define reusable permissions for your company or society staff."
        maxWidth="lg"
      >
        <form onSubmit={(e) => void handleCreateRole(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Role Name *</label>
            <input
              type="text"
              required
              value={roleTplName}
              onChange={(e) => setRoleTplName(e.target.value)}
              placeholder="e.g., Security Shift Supervisor"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <input
              type="text"
              value={roleTplDesc}
              onChange={(e) => setRoleTplDesc(e.target.value)}
              placeholder="Optional summary of responsibilities"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Permissions ({roleTplPerms.length} selected)
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ORG_STAFF_PERMISSIONS.map((perm) => (
                <label
                  key={perm.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs ${
                    roleTplPerms.includes(perm.key)
                      ? 'border-[#1D4ED8] bg-blue-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={roleTplPerms.includes(perm.key)}
                    onChange={() => toggleRoleTplPerm(perm.key)}
                    className="mt-0.5 rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{perm.label}</p>
                    <p className="text-slate-500">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setRoleModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingRole}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {savingRole ? 'Saving...' : 'Save Role Template'}
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
        entityLabel="Company / Society Staff"
        targetName={credentialsModal.targetName}
        email={credentialsModal.email}
        loginId={credentialsModal.loginId}
        initialPassword={credentialsModal.initialPassword}
        authStatusMessage={credentialsModal.authStatusMessage}
        onAuthProvisioned={async (uid) => {
          if (credentialsModal.staffId && userProfile) {
            await Promise.all([
              updateOrganizationStaff(credentialsModal.staffId, { uid }, userProfile).catch(
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Organization Staff"
        message={`Remove "${deleteTarget?.name}" (${deleteTarget?.employeeId})?`}
        confirmLabel="Delete Staff"
      />
    </DashboardLayout>
  );
}
