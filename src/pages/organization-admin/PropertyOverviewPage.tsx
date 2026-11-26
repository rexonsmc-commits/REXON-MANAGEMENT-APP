import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building, DoorOpen, Layers } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { useAuth } from '../../context/AuthContext';
import { listFlats, listTowers, listWings } from '../../services/organizations/organizationService';
import { Flat, Tower, Wing } from '../../types';
import { DEMO_FLATS, DEMO_TOWERS, DEMO_WINGS } from '../../utils/demoData';

export function PropertyOverviewPage() {
  const { userProfile } = useAuth();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [demoPreview, setDemoPreview] = useState(false);

  const orgId = userProfile?.organizationId || '';
  const isOrgStaff = userProfile?.role === 'organization_staff';
  const basePrefix = isOrgStaff ? '/organization-staff' : '/organization-admin';

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      listTowers(orgId).catch(() => []),
      listWings(orgId).catch(() => []),
      listFlats(orgId).catch(() => []),
    ]).then(([t, w, f]) => {
      setTowers(t);
      setWings(w);
      setFlats(f);
      if (!isOrgStaff && t.length === 0 && w.length === 0 && f.length === 0) {
        setDemoPreview(true);
      }
    });
  }, [orgId, isOrgStaff]);

  const effectiveDemo = !isOrgStaff && demoPreview;
  const activeTowers = effectiveDemo ? DEMO_TOWERS : towers;
  const activeWings = effectiveDemo ? DEMO_WINGS : wings;
  const activeFlats = effectiveDemo ? DEMO_FLATS : flats;

  return (
    <DashboardLayout
      title="Property & Society Management"
      subtitle="Hierarchical view of your organization's Towers, Wings, and Flat occupancy directory."
    >
      <div className="space-y-6">
        {!isOrgStaff && (
          <DemoDataBanner
            isDemoMode={demoPreview}
            onToggleDemo={() => setDemoPreview((p) => !p)}
            liveCount={towers.length + wings.length + flats.length}
            label="property records"
          />
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            title="Total Towers"
            value={activeTowers.length}
            icon={<Building className="h-5 w-5" />}
            tone="blue"
          />
          <KpiCard
            title="Total Wings"
            value={activeWings.length}
            icon={<Layers className="h-5 w-5" />}
            tone="default"
          />
          <KpiCard
            title="Total Flats / Units"
            value={activeFlats.length}
            icon={<DoorOpen className="h-5 w-5" />}
            tone="emerald"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <Link
            to={`${basePrefix}/towers`}
            className="rounded-xl border border-slate-200 bg-white p-6 hover:border-[#1D4ED8] transition-colors"
          >
            <Building className="h-6 w-6 text-[#1D4ED8]" />
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
              Tower Management
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Add, edit, or deactivate building towers and tower numbers.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8]">
              <span>Open Towers</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to={`${basePrefix}/wings`}
            className="rounded-xl border border-slate-200 bg-white p-6 hover:border-[#1D4ED8] transition-colors"
          >
            <Layers className="h-6 w-6 text-[#1D4ED8]" />
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">Wing Management</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Organize and assign wings directly to parent towers.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8]">
              <span>Open Wings</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to={`${basePrefix}/flats`}
            className="rounded-xl border border-slate-200 bg-white p-6 hover:border-[#1D4ED8] transition-colors"
          >
            <DoorOpen className="h-6 w-6 text-[#1D4ED8]" />
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">Flat Management</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Track flat types, owners, tenants, and occupancy status with PDF exports.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8]">
              <span>Open Flats</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
