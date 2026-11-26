import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Edit2, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createWing,
  deleteWing,
  listTowers,
  listWings,
  updateWing,
} from '../../services/organizations/organizationService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Tower, Wing } from '../../types';
import { DEMO_TOWERS, DEMO_WINGS } from '../../utils/demoData';

export function WingsPage() {
  const { userProfile, organization, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [towers, setTowers] = useState<Tower[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [towerFilter, setTowerFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Wing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Wing | null>(null);
  const [saving, setSaving] = useState(false);

  const [towerId, setTowerId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const orgId = userProfile?.organizationId || '';
  const isOrgStaff = userProfile?.role === 'organization_staff';
  const canManage = userProfile?.role === 'organization_admin' || hasPermission('manage_properties');
  const canExport = userProfile?.role === 'organization_admin' || hasPermission('export_pdf');

  const loadData = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [t, w] = await Promise.all([listTowers(orgId), listWings(orgId)]);
      setTowers(t);
      setWings(w);
    } catch (err) {
      showToast('Failed to load wings', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const effectiveDemo = !isOrgStaff && demoPreview;
  const activeTowers = effectiveDemo ? DEMO_TOWERS : towers;
  const activeWings = effectiveDemo ? DEMO_WINGS : wings;

  const filtered = useMemo(() => {
    return activeWings.filter((w) => {
      const mSearch =
        !search.trim() ||
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.towerName || '').toLowerCase().includes(search.toLowerCase());
      const mTower = towerFilter === 'all' || w.towerId === towerFilter;
      return mSearch && mTower;
    });
  }, [activeWings, search, towerFilter]);

  const openAdd = () => {
    setEditing(null);
    setTowerId(towers[0]?.id || '');
    setName('');
    setDescription('');
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (w: Wing) => {
    setEditing(w);
    setTowerId(w.towerId);
    setName(w.name);
    setDescription(w.description || '');
    setStatus(w.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId || !towerId) return;
    const selectedTower = towers.find((t) => t.id === towerId);
    setSaving(true);
    try {
      if (editing) {
        await updateWing(
          editing.id,
          { towerId, towerName: selectedTower?.name || editing.towerName, name, description, status },
          userProfile
        );
        showToast('Wing updated', 'success', name);
      } else {
        await createWing(
          {
            organizationId: orgId,
            towerId,
            towerName: selectedTower?.name || '',
            name,
            description,
            status,
          },
          userProfile
        );
        showToast('Wing added', 'success', name);
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

  const handleDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setSaving(true);
    try {
      await deleteWing(deleteTarget.id, orgId, userProfile);
      showToast('Wing deleted', 'success', deleteTarget.name);
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
      title: 'Wing Directory Report',
      organizationName: organization?.name || userProfile?.organizationName,
      generatedBy: userProfile?.email || 'Organization Admin',
      columns: ['Wing Name', 'Assigned Tower', 'Description', 'Status'],
      rows: filtered.map((w) => [w.name, w.towerName || w.towerId, w.description || '—', w.status]),
      filename: 'rexon-wings-report',
    });
  };

  const columns: ColumnDef<Wing>[] = [
    {
      key: 'name',
      header: 'Wing Name',
      sortable: true,
      sortValue: (w) => w.name,
      render: (w) => <span className="font-semibold text-slate-900">{w.name}</span>,
    },
    {
      key: 'tower',
      header: 'Assigned Tower',
      sortable: true,
      sortValue: (w) => w.towerName || w.towerId,
      render: (w) => <span className="text-slate-700">{w.towerName || w.towerId}</span>,
    },
    {
      key: 'desc',
      header: 'Description',
      render: (w) => <span className="text-slate-600">{w.description || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => <StatusLabel status={w.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (w) =>
        effectiveDemo || !canManage ? (
          <span className="text-xs text-slate-400">{effectiveDemo ? 'Preview only' : 'View only'}</span>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(w)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1D4ED8]"
              title="Edit wing"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {userProfile?.role === 'organization_admin' && (
              <button
                type="button"
                onClick={() => setDeleteTarget(w)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                title="Delete wing"
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
      title="Wing Management"
      subtitle="Add wings and assign them to registered towers in your organization."
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
              <span>Add Wing</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {!isOrgStaff && (
          <DemoDataBanner
            isDemoMode={demoPreview}
            onToggleDemo={() => setDemoPreview((p) => !p)}
            liveCount={wings.length}
            label="wings"
          />
        )}

        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(w) => w.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search wing or tower..."
          filters={[
            {
              key: 'tower',
              label: 'Filter by tower',
              value: towerFilter,
              onChange: setTowerFilter,
              options: [
                { label: 'All Towers', value: 'all' },
                ...activeTowers.map((t) => ({ label: t.name, value: t.id })),
              ],
            },
          ]}
          emptyTitle="No wings configured yet"
          emptyDescription="Ensure at least one Tower is created, then add wings assigned to it."
          emptyAction={
            canManage &&
            towers.length > 0 && (
              <button
                type="button"
                onClick={openAdd}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Add First Wing
              </button>
            )
          }
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Wing' : 'Add Wing'}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Assign to Tower *</label>
            <select
              required
              value={towerId}
              onChange={(e) => setTowerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select tower...</option>
              {towers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.towerNumber})
                </option>
              ))}
            </select>
            {towers.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Create a live Tower first in Tower Management before adding wings.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Wing Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wing A (East)"
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
            <label className="block text-xs font-semibold text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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
              disabled={saving || towers.length === 0}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Wing'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Wing"
        message={`Delete wing "${deleteTarget?.name}"?`}
        confirmLabel="Delete Wing"
      />
    </DashboardLayout>
  );
}
