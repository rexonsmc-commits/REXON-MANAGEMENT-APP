import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Edit2, KeyRound, Plus, Power, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { SUPER_ADMIN_STAFF_PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createSuperAdminStaff,
  deleteSuperAdminStaff,
  issuePasswordSetupInvite,
  listSuperAdminStaff,
  updateSuperAdminStaff,
} from '../../services/staff/staffService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { AccountStatus, SuperAdminPermissionKey, SuperAdminStaff } from '../../types';
import { DEMO_SUPER_ADMIN_STAFF } from '../../utils/demoData';

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
    setModalOpen(true);
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
      } else {
        await createSuperAdminStaff(
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
        showToast(
          'Super Admin Staff provisioned',
          'success',
          `${name} can now sign in with ${email} via Google or password setup.`
        );
      }
      setModalOpen(false);
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

  const handleSendInvite = async (staff: SuperAdminStaff) => {
    try {
      const msg = await issuePasswordSetupInvite(staff.email);
      showToast('Password invite dispatched', 'success', msg);
    } catch (err) {
      showToast('Invite failed', 'error', err instanceof Error ? err.message : undefined);
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
      header: 'Actions',
      align: 'right',
      render: (s) =>
        demoPreview ? (
          <span className="text-xs text-slate-400">Preview only</span>
        ) : (
          <div className="inline-flex items-center gap-1">
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
              onClick={() => void handleSendInvite(s)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-[#1D4ED8]"
              title="Send password setup / reset invite"
            >
              <KeyRound className="h-4 w-4" />
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
      subtitle="Provision global operations staff and independently assign or revoke granular platform permissions."
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
          emptyDescription="Add Super Admin Staff accounts and assign granular permissions without modifying your own session."
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
        subtitle="Staff accounts authenticate via Firebase Auth without overwriting your Super Admin session."
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
              <label className="block text-xs font-semibold text-slate-700">Email *</label>
              <input
                type="email"
                required
                disabled={Boolean(editingStaff)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Login ID (Optional)
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. ops.lead"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none"
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <strong className="text-slate-800">Password Setup:</strong> Staff authenticate with
              Google Sign-In or trigger a Firebase password setup/reset link. Plain-text passwords
              are never stored in Firestore.
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
