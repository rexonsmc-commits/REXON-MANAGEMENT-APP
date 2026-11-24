import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Modal } from '../../components/common/Modal';
import { ORG_STAFF_PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createRoleTemplate,
  deleteRoleTemplate,
  listRoleTemplates,
} from '../../services/staff/staffService';
import { OrgStaffPermissionKey, RoleTemplate } from '../../types';

export function OrgRolesPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<OrgStaffPermissionKey[]>(['view_dashboard']);
  const [saving, setSaving] = useState(false);

  const orgId = userProfile?.organizationId || '';

  const loadRoles = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listRoleTemplates(orgId);
      setRoles(data);
    } catch (err) {
      showToast('Failed to load role templates', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const togglePerm = (key: OrgStaffPermissionKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId) return;
    setSaving(true);
    try {
      await createRoleTemplate(
        { organizationId: orgId, name, description, permissions },
        userProfile
      );
      showToast('Role template created', 'success', name);
      setModalOpen(false);
      setName('');
      setDescription('');
      await loadRoles();
    } catch (err) {
      showToast('Failed to create role', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!userProfile || !orgId) return;
    try {
      await deleteRoleTemplate(roleId, orgId, userProfile);
      showToast('Role template removed', 'success');
      await loadRoles();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <DashboardLayout
      title="Roles & Permissions Builder"
      subtitle="Create reusable permission templates tailored to your organization's departments."
      actions={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>New Role Template</span>
        </button>
      }
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#1D4ED8]" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            No Custom Role Templates Defined
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Create reusable templates (e.g., Gate Supervisor, Reception Coordinator, Estate Manager)
            to apply consistent permissions when onboarding staff.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
          >
            Create First Role Template
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900">{r.name}</h2>
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {r.description && <p className="mt-1 text-xs text-slate-500">{r.description}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Role Template"
        maxWidth="lg"
      >
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Role Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Security Shift Supervisor"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Permissions ({permissions.length} selected)
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ORG_STAFF_PERMISSIONS.map((perm) => (
                <label
                  key={perm.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.key)}
                    onChange={() => togglePerm(perm.key)}
                  />
                  <span className="font-medium text-slate-800">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
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
              {saving ? 'Saving...' : 'Save Role Template'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
