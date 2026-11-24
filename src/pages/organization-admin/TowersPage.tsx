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
  createTower,
  deleteTower,
  listTowers,
  updateTower,
} from '../../services/organizations/organizationService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Tower } from '../../types';
import { DEMO_TOWERS } from '../../utils/demoData';

export function TowersPage() {
  const { userProfile, organization, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tower | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tower | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [towerNumber, setTowerNumber] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const orgId = userProfile?.organizationId || '';
  const canManage = userProfile?.role === 'organization_admin' || hasPermission('manage_properties');
  const canExport = userProfile?.role === 'organization_admin' || hasPermission('export_pdf');

  const loadData = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTowers(await listTowers(orgId));
    } catch (err) {
      showToast('Failed to load towers', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeData = demoPreview ? DEMO_TOWERS : towers;

  const filtered = useMemo(() => {
    return activeData.filter((t) => {
      const mSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.towerNumber.toLowerCase().includes(search.toLowerCase());
      const mStatus = statusFilter === 'all' || t.status === statusFilter;
      return mSearch && mStatus;
    });
  }, [activeData, search, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setTowerNumber('');
    setDescription('');
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (t: Tower) => {
    setEditing(t);
    setName(t.name);
    setTowerNumber(t.towerNumber);
    setDescription(t.description || '');
    setStatus(t.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateTower(editing.id, { name, towerNumber, description, status }, userProfile);
        showToast('Tower updated', 'success', name);
      } else {
        await createTower(
          { organizationId: orgId, name, towerNumber, description, status },
          userProfile
        );
        showToast('Tower created', 'success', name);
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
      await deleteTower(deleteTarget.id, orgId, userProfile);
      showToast('Tower deleted', 'success', deleteTarget.name);
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
      title: 'Tower Directory Report',
      organizationName: organization?.name || userProfile?.organizationName,
      generatedBy: userProfile?.email || 'Organization Admin',
      columns: ['Tower Number', 'Tower Name', 'Description', 'Status'],
      rows: filtered.map((t) => [t.towerNumber, t.name, t.description || '—', t.status]),
      filename: 'rexon-towers-report',
    });
  };

  const columns: ColumnDef<Tower>[] = [
    {
      key: 'number',
      header: 'Tower No.',
      sortable: true,
      sortValue: (t) => t.towerNumber,
      render: (t) => <span className="font-mono text-xs font-semibold text-slate-900">{t.towerNumber}</span>,
    },
    {
      key: 'name',
      header: 'Tower Name',
      sortable: true,
      sortValue: (t) => t.name,
      render: (t) => <span className="font-semibold text-slate-900">{t.name}</span>,
    },
    {
      key: 'desc',
      header: 'Description',
      render: (t) => <span className="text-slate-600">{t.description || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusLabel status={t.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (t) =>
        demoPreview || !canManage ? (
          <span className="text-xs text-slate-400">{demoPreview ? 'Preview only' : 'View only'}</span>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(t)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1D4ED8]"
              title="Edit tower"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {userProfile?.role === 'organization_admin' && (
              <button
                type="button"
                onClick={() => setDeleteTarget(t)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                title="Delete tower"
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
      title="Tower Management"
      subtitle="Manage towers, blocks, and buildings inside your organization."
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
              <span>Add Tower</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={towers.length}
          label="towers"
        />

        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(t) => t.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tower name or number..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { label: 'All Statuses', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ],
            },
          ]}
          emptyTitle="No towers added yet"
          emptyDescription="Add your first building tower before creating wings and flats."
          emptyAction={
            canManage && (
              <button
                type="button"
                onClick={openAdd}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Add First Tower
              </button>
            )
          }
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Tower' : 'Add Tower'}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tower Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Tower Alpha"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tower Number *</label>
              <input
                type="text"
                required
                value={towerNumber}
                onChange={(e) => setTowerNumber(e.target.value)}
                placeholder="e.g., T-01"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
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
              disabled={saving}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Tower'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Tower"
        message={`Delete tower "${deleteTarget?.name}"?`}
        confirmLabel="Delete Tower"
      />
    </DashboardLayout>
  );
}
