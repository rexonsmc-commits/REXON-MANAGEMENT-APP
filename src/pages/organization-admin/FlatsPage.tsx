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
  createFlat,
  deleteFlat,
  listFlats,
  listTowers,
  listWings,
  updateFlat,
} from '../../services/organizations/organizationService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Flat, OccupancyType, Tower, Wing } from '../../types';
import { DEMO_FLATS, DEMO_TOWERS, DEMO_WINGS } from '../../utils/demoData';

export function FlatsPage() {
  const { userProfile, organization, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [towers, setTowers] = useState<Tower[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [towerFilter, setTowerFilter] = useState('all');
  const [occupancyFilter, setOccupancyFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Flat | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [towerId, setTowerId] = useState('');
  const [wingId, setWingId] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [flatType, setFlatType] = useState('2 BHK');
  const [ownerName, setOwnerName] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [occupancyType, setOccupancyType] = useState<OccupancyType>('Owner Occupied');
  const [tenantName, setTenantName] = useState('');
  const [tenantContact, setTenantContact] = useState('');
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
      const [t, w, f] = await Promise.all([
        listTowers(orgId),
        listWings(orgId),
        listFlats(orgId),
      ]);
      setTowers(t);
      setWings(w);
      setFlats(f);
    } catch (err) {
      showToast('Failed to load flats', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeTowers = demoPreview ? DEMO_TOWERS : towers;
  const activeFlats = demoPreview ? DEMO_FLATS : flats;

  const wingsForSelectedTower = useMemo(
    () => wings.filter((w) => w.towerId === towerId),
    [wings, towerId]
  );

  const filtered = useMemo(() => {
    return activeFlats.filter((f) => {
      const mSearch =
        !search.trim() ||
        f.flatNumber.toLowerCase().includes(search.toLowerCase()) ||
        f.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        (f.tenantName || '').toLowerCase().includes(search.toLowerCase());
      const mTower = towerFilter === 'all' || f.towerId === towerFilter;
      const mOcc = occupancyFilter === 'all' || f.occupancyType === occupancyFilter;
      return mSearch && mTower && mOcc;
    });
  }, [activeFlats, search, towerFilter, occupancyFilter]);

  const openAdd = () => {
    const firstTower = towers[0]?.id || '';
    const firstWing = wings.find((w) => w.towerId === firstTower)?.id || '';
    setEditing(null);
    setTowerId(firstTower);
    setWingId(firstWing);
    setFlatNumber('');
    setFloorNumber('1');
    setFlatType('2 BHK');
    setOwnerName('');
    setOwnerContact('');
    setOwnerEmail('');
    setOccupancyType('Owner Occupied');
    setTenantName('');
    setTenantContact('');
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (f: Flat) => {
    setEditing(f);
    setTowerId(f.towerId);
    setWingId(f.wingId);
    setFlatNumber(f.flatNumber);
    setFloorNumber(f.floorNumber);
    setFlatType(f.flatType);
    setOwnerName(f.ownerName);
    setOwnerContact(f.ownerContact || '');
    setOwnerEmail(f.ownerEmail || '');
    setOccupancyType(f.occupancyType);
    setTenantName(f.tenantName || '');
    setTenantContact(f.tenantContact || '');
    setStatus(f.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId || !towerId || !wingId) return;

    const selectedTower = towers.find((t) => t.id === towerId);
    const selectedWing = wings.find((w) => w.id === wingId);
    setSaving(true);
    try {
      const payload = {
        organizationId: orgId,
        towerId,
        towerName: selectedTower?.name || '',
        wingId,
        wingName: selectedWing?.name || '',
        flatNumber,
        floorNumber,
        flatType,
        ownerName,
        ownerContact,
        ownerEmail,
        occupancyType,
        tenantName: occupancyType === 'Tenant Occupied' ? tenantName : '',
        tenantContact: occupancyType === 'Tenant Occupied' ? tenantContact : '',
        status,
      };

      if (editing) {
        await updateFlat(editing.id, payload, userProfile);
        showToast('Flat updated', 'success', flatNumber);
      } else {
        await createFlat(payload, userProfile);
        showToast('Flat added', 'success', flatNumber);
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
      await deleteFlat(deleteTarget.id, orgId, userProfile);
      showToast('Flat deleted', 'success', deleteTarget.flatNumber);
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
      title: 'Flats & Occupancy Directory',
      organizationName: organization?.name || userProfile?.organizationName,
      generatedBy: userProfile?.email || 'Organization Admin',
      columns: ['Flat No', 'Tower / Wing', 'Floor', 'Type', 'Owner', 'Occupancy', 'Tenant', 'Status'],
      rows: filtered.map((f) => [
        f.flatNumber,
        `${f.towerName || f.towerId} / ${f.wingName || f.wingId}`,
        f.floorNumber,
        f.flatType,
        f.ownerName,
        f.occupancyType,
        f.tenantName || '—',
        f.status,
      ]),
      filename: 'rexon-flats-report',
    });
  };

  const columns: ColumnDef<Flat>[] = [
    {
      key: 'flatNumber',
      header: 'Flat No.',
      sortable: true,
      sortValue: (f) => f.flatNumber,
      render: (f) => (
        <div>
          <p className="font-mono text-xs font-bold text-slate-900">{f.flatNumber}</p>
          <p className="text-xs text-slate-500">
            Floor {f.floorNumber} · {f.flatType}
          </p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Tower & Wing',
      render: (f) => (
        <div>
          <p className="font-medium text-slate-800">{f.towerName || f.towerId}</p>
          <p className="text-xs text-slate-500">{f.wingName || f.wingId}</p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner Details',
      render: (f) => (
        <div>
          <p className="font-medium text-slate-800">{f.ownerName}</p>
          <p className="text-xs text-slate-500">{f.ownerContact || f.ownerEmail || '—'}</p>
        </div>
      ),
    },
    {
      key: 'occupancy',
      header: 'Occupancy & Tenant',
      render: (f) => (
        <div>
          <p className="text-xs font-semibold text-slate-800">{f.occupancyType}</p>
          {f.occupancyType === 'Tenant Occupied' && f.tenantName && (
            <p className="text-xs text-slate-500">
              {f.tenantName} {f.tenantContact ? `· ${f.tenantContact}` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (f) => <StatusLabel status={f.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (f) =>
        demoPreview || !canManage ? (
          <span className="text-xs text-slate-400">{demoPreview ? 'Preview only' : 'View only'}</span>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(f)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1D4ED8]"
              title="Edit flat"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {userProfile?.role === 'organization_admin' && (
              <button
                type="button"
                onClick={() => setDeleteTarget(f)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                title="Delete flat"
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
      title="Flat Management"
      subtitle="Manage flat numbers, tower/wing mapping, owner contacts, and tenant occupancy details."
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
              <span>Add Flat</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={flats.length}
          label="flats"
        />

        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(f) => f.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search flat number, owner, or tenant..."
          filters={[
            {
              key: 'tower',
              label: 'Tower',
              value: towerFilter,
              onChange: setTowerFilter,
              options: [
                { label: 'All Towers', value: 'all' },
                ...activeTowers.map((t) => ({ label: t.name, value: t.id })),
              ],
            },
            {
              key: 'occupancy',
              label: 'Occupancy',
              value: occupancyFilter,
              onChange: setOccupancyFilter,
              options: [
                { label: 'All Occupancy Types', value: 'all' },
                { label: 'Owner Occupied', value: 'Owner Occupied' },
                { label: 'Tenant Occupied', value: 'Tenant Occupied' },
                { label: 'Vacant', value: 'Vacant' },
              ],
            },
          ]}
          emptyTitle="No flats registered yet"
          emptyDescription="Create Towers and Wings first, then register flats with owner and tenant occupancy details."
          emptyAction={
            canManage &&
            wings.length > 0 && (
              <button
                type="button"
                onClick={openAdd}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Add First Flat
              </button>
            )
          }
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Flat Record' : 'Add Flat Record'}
        maxWidth="xl"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Tower *</label>
              <select
                required
                value={towerId}
                onChange={(e) => {
                  const nextT = e.target.value;
                  setTowerId(nextT);
                  const firstW = wings.find((w) => w.towerId === nextT)?.id || '';
                  setWingId(firstW);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select tower...</option>
                {towers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Wing *</label>
              <select
                required
                value={wingId}
                onChange={(e) => setWingId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select wing...</option>
                {wingsForSelectedTower.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Flat Number *</label>
              <input
                type="text"
                required
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="e.g., A-402"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Floor Number *</label>
              <input
                type="text"
                required
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Flat Type *</label>
              <input
                type="text"
                required
                value={flatType}
                onChange={(e) => setFlatType(e.target.value)}
                placeholder="e.g., 3 BHK / Studio / Office"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Owner Name *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Owner Contact</label>
              <input
                type="text"
                value={ownerContact}
                onChange={(e) => setOwnerContact(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Owner Email</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Occupancy Type</label>
              <select
                value={occupancyType}
                onChange={(e) => setOccupancyType(e.target.value as OccupancyType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Owner Occupied">Owner Occupied</option>
                <option value="Tenant Occupied">Tenant Occupied</option>
                <option value="Vacant">Vacant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Record Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {occupancyType === 'Tenant Occupied' && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tenant Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tenant Contact
                </label>
                <input
                  type="text"
                  value={tenantContact}
                  onChange={(e) => setTenantContact(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

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
              disabled={saving || towers.length === 0 || wings.length === 0}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Flat'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Flat"
        message={`Delete flat "${deleteTarget?.flatNumber}"?`}
        confirmLabel="Delete Flat"
      />
    </DashboardLayout>
  );
}
