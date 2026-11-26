import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Trash2,
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
import { SUPER_ADMIN_STAFF_PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  provisionFirebaseAuthCredentials,
  syncProvisionedAccountProfile,
} from '../../services/auth/authService';
import {
  createSuperAdminStaff,
  deleteSuperAdminStaff,
  listSuperAdminStaff,
  updateSuperAdminStaff,
} from '../../services/staff/staffService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { AccountStatus, SuperAdminPermissionKey, SuperAdminStaff } from '../../types';
import { DEMO_SUPER_ADMIN_STAFF } from '../../utils/demoData';

interface CredentialsModalState {
  open: boolean;
  staffId?: string;
  targetName: string;
  email: string;
  loginId?: string;
  initialPassword?: string;
  authStatusMessage?: string;
}

export function SuperAdminStaffPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [staffList, setStaffList] = useState<SuperAdminStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<SuperAdminStaff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminStaff | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [permissions, setPermissions] = useState<SuperAdminPermissionKey[]>(['view_dashboard']);

  // Firebase Auth Login ID & Password provisioning
  const [createAuthCredentials, setCreateAuthCredentials] = useState(true);
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<CredentialsModalState>({
    open: false,
    targetName: '',
    email: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSuperAdminStaff();
      setStaffList(data);
    } catch (err) {
      showToast('Failed to load staff', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeData = demoPreview ? DEMO_SUPER_ADMIN_STAFF : staffList;

  const filtered = useMemo(() => {
    return activeData.filter((s) => {
      const matchesSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.department.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeData, search, statusFilter]);

  const openAdd = () => {
    setEditingStaff(null);
    setName('');
    setEmail('');
    setPhone('');
    setLoginId('');
    setDesignation('');
    setDepartment('Operations');
    setAssignedRole('Operations Analyst');
    setStatus('active');
    setPermissions(['view_dashboard']);
    setCreateAuthCredentials(true);
    setInitialPassword('');
    setShowInitialPassword(false);
    setModalOpen(true);
  };

  const openEdit = (staff: SuperAdminStaff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setEmail(staff.email);
    setPhone(staff.phone || '');
    setLoginId(staff.loginId || '');
    setDesignation(staff.designation);
    setDepartment(staff.department);
    setAssignedRole(staff.assignedRole);
    setStatus(staff.status);
    setPermissions(staff.permissions);
    setCreateAuthCredentials(false);
    setInitialPassword('');
    setShowInitialPassword(false);
    setModalOpen(true);
  };

  const openCredentialsModalForStaff = (staff: SuperAdminStaff) => {
    setCredentialsModal({
      open: true,
      staffId: staff.id,
      targetName: staff.name,
      email: staff.email,
      loginId: staff.loginId,
    });
  };

  const togglePermission = (key: SuperAdminPermissionKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!name.trim() || !email.trim() || !designation.trim()) {
      showToast('Missing required fields', 'error', 'Name, email, and designation are required.');
      return;
    }
    if (!editingStaff && createAuthCredentials && initialPassword.trim().length < 6) {
      showToast(
        'Password required',
        'error',
        'Enter a login password of at least 6 characters to save credentials in Firebase Authentication.'
      );
      return;
    }

    setSaving(true);
    try {
      if (editingStaff) {
        await updateSuperAdminStaff(
          editingStaff.id,
          {
            name,
            email,
            phone: phone.trim() || undefined,
            loginId: loginId.trim() || undefined,
            designation,
            department,
            assignedRole,
            permissions,
            status,
          },
          userProfile
        );
        showToast('Staff permissions updated', 'success', `${name} updated cleanly.`);
        setModalOpen(false);
      } else {
        const createdStaff = await createSuperAdminStaff(
          {
            name,
            email,
            phone: phone.trim() || undefined,
            loginId: loginId.trim() || undefined,
            designation,
            department,
            assignedRole,
            permissions,
            status,
          },
          userProfile
        );

        let authStatusMessage =
          'Staff role provisioned in Firestore. Use the Login Credentials modal anytime to set or reset the password.';
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
                updateSuperAdminStaff(
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
          'Super Admin Staff provisioned',
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
      showToast('Failed to save staff', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (staff: SuperAdminStaff) => {
    if (!userProfile) return;
    const nextStatus: AccountStatus = staff.status === 'active' ? 'inactive' : 'active';
    try {
      await updateSuperAdminStaff(staff.id, { status: nextStatus }, userProfile);
      showToast(`Staff marked ${nextStatus}`, 'success', staff.name);
      await loadData();
    } catch (err) {
      showToast('Status update failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setSaving(true);
    try {
      await deleteSuperAdminStaff(deleteTarget.id, deleteTarget.name, userProfile);
      showToast('Staff removed', 'success', deleteTarget.name);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfExport = () => {
    exportTableToPdf({
      title: 'Super Admin Staff Directory',
      generatedBy: userProfile?.email || 'Super Admin',
      columns: ['Name', 'Email', 'Designation', 'Department', 'Role', 'Permissions', 'Status'],
      rows: filtered.map((s) => [
        s.name,
        s.email,
        s.designation,
        s.department,
        s.assignedRole,
        s.permissions.length,
        s.status,
      ]),
      filename: 'rexon-super-admin-staff',
    });
  };

  const columns: ColumnDef<SuperAdminStaff>[] = [
    {
      key: 'name',
      header: 'Staff Name',
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
      key: 'role',
      header: 'Role & Designation',
      render: (s) => (
        <div>
          <p className="font-medium text-slate-800">{s.assignedRole}</p>
          <p className="text-xs text-slate-500">
            {s.designation} · {s.department}
          </p>
        </div>
      ),
    },
    {
      key: 'perms',
      header: 'Granted Permissions',
      render: (s) => (
        <span className="font-mono text-xs text-slate-700 tabular-nums">
          {s.permissions.length} enabled
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
        demoPreview ? (
          <span className="text-xs text-slate-400">Preview only</span>
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
              title="Edit staff & permissions"
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
            <button
              type="button"
              onClick={() => setDeleteTarget(s)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              title="Delete staff"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
    },
  ];

  return (
    <DashboardLayout
      title="Super Admin Staff Management"
      subtitle="Provision global operations staff, configure Firebase Auth login credentials, and assign granular platform permissions."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePdfExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Staff</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={staffList.length}
          label="Super Admin staff"
        />

        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(s) => s.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search staff by name, email, or department..."
          filters={[
            {
              key: 'status',
              label: 'Status filter',
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
          emptyTitle="No Super Admin Staff added yet"
          emptyDescription="Add Super Admin Staff accounts with Firebase login credentials and granular permissions."
          emptyAction={
            <button
              type="button"
              onClick={openAdd}
              className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
            >
              Add First Staff Member
            </button>
          }
        />
      </div>

      {/* Add / Edit Staff & Permissions Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStaff ? 'Edit Super Admin Staff' : 'Add Super Admin Staff'}
        subtitle="Provisions staff login credentials in Firebase Authentication without interrupting your Super Admin session."
        maxWidth="xl"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Staff Name *</label>
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
                placeholder="+1 (555) 000-0000"
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
              <label className="block text-xs font-semibold text-slate-700">Department *</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Assigned Role *</label>
              <input
                type="text"
                required
                value={assignedRole}
                onChange={(e) => setAssignedRole(e.target.value)}
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
              {editingStaff ? (
                <button
                  type="button"
                  onClick={() => openCredentialsModalForStaff(editingStaff)}
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
                  disabled={Boolean(editingStaff)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@rexon.com"
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
                  placeholder="e.g. ops.lead"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            {!editingStaff && createAuthCredentials && (
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
                  Saved directly in Firebase Authentication without disturbing your Super Admin session.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AccountStatus)}
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

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Custom Permission Assignment
              </label>
              <span className="text-xs text-slate-500 tabular-nums">
                {permissions.length} / {SUPER_ADMIN_STAFF_PERMISSIONS.length} selected
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SUPER_ADMIN_STAFF_PERMISSIONS.map((perm) => {
                const checked = permissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                      checked
                        ? 'border-[#1D4ED8] bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.key)}
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
              {saving ? 'Saving...' : editingStaff ? 'Save Permissions' : 'Create Staff Account'}
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
        entityLabel="Super Admin Staff"
        targetName={credentialsModal.targetName}
        email={credentialsModal.email}
        loginId={credentialsModal.loginId}
        initialPassword={credentialsModal.initialPassword}
        authStatusMessage={credentialsModal.authStatusMessage}
        onAuthProvisioned={async (uid) => {
          if (credentialsModal.staffId && userProfile) {
            await Promise.all([
              updateSuperAdminStaff(credentialsModal.staffId, { uid }, userProfile).catch(
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
        title="Remove Super Admin Staff"
        message={`Remove "${deleteTarget?.name}" from Super Admin Staff?`}
        confirmLabel="Remove Staff"
      />
    </DashboardLayout>
  );
}
