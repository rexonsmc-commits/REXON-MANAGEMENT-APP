import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Edit2, KeyRound, Plus, Power, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import {
  EXAMPLE_ORG_DEPARTMENTS,
  ORG_STAFF_PERMISSIONS,
} from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createOrganizationStaff,
  deleteOrganizationStaff,
  issuePasswordSetupInvite,
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

export function OrgStaffPage() {
  const { userProfile, organization, hasPermission } = useAuth();
  const { showToast } = useToast();

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

  // Form state
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Security');
  const [roleName, setRoleName] = useState('');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [permissions, setPermissions] = useState<OrgStaffPermissionKey[]>(['view_dashboard']);

  const orgId = userProfile?.organizationId || '';
  const canManage = userProfile?.role === 'organization_admin' || hasPermission('manage_staff');
  const canExport = userProfile?.role === 'organization_admin' || hasPermission('export_pdf');

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

  const activeData = demoPreview ? DEMO_ORG_STAFF : staffList;

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

  const openAdd = () => {
    setEditing(null);
    setEmployeeId(`EMP-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setEmail('');
    setPhone('');
    setLoginId('');
    setDesignation('');
    setDepartment('Security');
    setRoleName('Security Supervisor');
    setStatus('active');
    setPermissions(['view_dashboard', 'view_properties']);
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
    setStatus(s.status);
    setPermissions(s.permissions);
    setModalOpen(true);
  };

  const applyRoleTemplate = (templateId: string) => {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId) return;
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
      } else {
        await createOrganizationStaff(
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
          organization?.name
        );
        showToast('Staff member provisioned', 'success', `${name} (${email})`);
      }
      setModalOpen(false);
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

  const handleSendInvite = async (s: OrganizationStaff) => {
    try {
      const msg = await issuePasswordSetupInvite(s.email);
      showToast('Password invite dispatched', 'success', msg);
    } catch (err) {
      showToast('Invite failed', 'error', err instanceof Error ? err.message : undefined);
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
      render: (s) => <span className="font-mono text-xs font-semibold text-slate-800">{s.employeeId}</span>,
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
          <p className="font-medium text-slate-800">{s.department} · {s.role}</p>
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
      header: 'Actions',
      align: 'right',
      render: (s) =>
        demoPreview || !canManage ? (
          <span className="text-xs text-slate-400">{demoPreview ? 'Preview only' : 'View only'}</span>
        ) : (
          <div className="inline-flex items-center gap-1">
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
            {userProfile?.role === 'organization_admin' && (
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
      title="Organization Staff Management"
      subtitle="Manage staff accounts, flexible departments, custom roles, and module permissions strictly within your organization."
      actions={
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={openAdd}
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
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={staffList.length}
          label="staff members"
        />

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
          emptyDescription="Add employees, guards, receptionists, or maintenance leads and configure their module permissions."
          emptyAction={
            canManage && (
              <button
                type="button"
                onClick={openAdd}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Add First Staff Member
              </button>
            )
          }
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Organization Staff' : 'Add Organization Staff'}
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Employee Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email *</label>
              <input
                type="email"
                required
                disabled={Boolean(editing)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                placeholder="e.g. sec.supervisor"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Apply Saved Role Template (Optional)
              </label>
              <select
                onChange={(e) => applyRoleTemplate(e.target.value)}
                defaultValue=""
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
            <label className="block text-xs font-semibold text-slate-700">
              Module Permissions ({permissions.length} selected)
            </label>
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
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
            >
              {saving ? 'Saving...' : editing ? 'Save Staff Changes' : 'Create Staff Account'}
            </button>
          </div>
        </form>
      </Modal>

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
