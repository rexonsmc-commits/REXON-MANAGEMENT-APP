import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, CreditCard, DoorOpen, Layers, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { StatusLabel } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import {
  listFlats,
  listTowers,
  listWings,
} from '../../services/organizations/organizationService';
import { listOrganizationStaff } from '../../services/staff/staffService';
import { Flat, OrganizationStaff, Tower, Wing } from '../../types';
import {
  DEMO_FLATS,
  DEMO_ORG_STAFF,
  DEMO_TOWERS,
  DEMO_WINGS,
} from '../../utils/demoData';

export function OrgAdminDashboard() {
  const { userProfile, organization } = useAuth();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [staff, setStaff] = useState<OrganizationStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const orgId = userProfile?.organizationId || '';

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([
      listTowers(orgId).catch(() => []),
      listWings(orgId).catch(() => []),
      listFlats(orgId).catch(() => []),
      listOrganizationStaff(orgId).catch(() => []),
    ])
      .then(([t, w, f, s]) => {
        if (!active) return;
        setTowers(t);
        setWings(w);
        setFlats(f);
        setStaff(s);
        if (t.length === 0 && s.length === 0) {
          setDemoPreview(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgId]);

  const activeTowers = demoPreview ? DEMO_TOWERS : towers;
  const activeWings = demoPreview ? DEMO_WINGS : wings;
  const activeFlats = demoPreview ? DEMO_FLATS : flats;
  const activeStaff = demoPreview ? DEMO_ORG_STAFF : staff;

  const occupancyChart = [
    {
      type: 'Owner Occupied',
      count: activeFlats.filter((f) => f.occupancyType === 'Owner Occupied').length,
    },
    {
      type: 'Tenant Occupied',
      count: activeFlats.filter((f) => f.occupancyType === 'Tenant Occupied').length,
    },
    {
      type: 'Vacant',
      count: activeFlats.filter((f) => f.occupancyType === 'Vacant').length,
    },
  ];

  return (
    <DashboardLayout
      title="Organization Operations Dashboard"
      subtitle={`Isolated tenant workspace for ${organization?.name || userProfile?.organizationName || 'your organization'}.`}
    >
      <div className="space-y-6">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={towers.length + staff.length + flats.length}
          label="tenant records"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="Organization Staff"
            value={loading ? '...' : activeStaff.length}
            icon={<Users className="h-5 w-5" />}
            tone="blue"
          />
          <KpiCard
            title="Towers"
            value={loading ? '...' : activeTowers.length}
            icon={<Building className="h-5 w-5" />}
            tone="default"
          />
          <KpiCard
            title="Wings"
            value={loading ? '...' : activeWings.length}
            icon={<Layers className="h-5 w-5" />}
            tone="default"
          />
          <KpiCard
            title="Flats / Units"
            value={loading ? '...' : activeFlats.length}
            icon={<DoorOpen className="h-5 w-5" />}
            tone="emerald"
          />
          <KpiCard
            title="Subscription"
            value={organization?.subscriptionStatus || 'Pending'}
            subtitle={organization?.subscriptionPlanName || 'Unassigned'}
            icon={<CreditCard className="h-5 w-5" />}
            tone={organization?.subscriptionStatus === 'Active' ? 'emerald' : 'amber'}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <h2 className="font-display text-base font-bold text-slate-900">
              Unit Occupancy Distribution
            </h2>
            <p className="text-xs text-slate-500">
              Breakdown across Owner Occupied, Tenant Occupied, and Vacant units
            </p>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <h2 className="font-display text-base font-bold text-slate-900">
              Quick Tenant Shortcuts
            </h2>
            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Add & Manage Staff', to: '/organization-admin/staff' },
                { label: 'Configure Role Templates', to: '/organization-admin/roles' },
                { label: 'Manage Towers', to: '/organization-admin/towers' },
                { label: 'Manage Wings', to: '/organization-admin/wings' },
                { label: 'Manage Flats & Occupancy', to: '/organization-admin/flats' },
                { label: 'Export PDF Directories', to: '/organization-admin/reports' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#1D4ED8] hover:text-[#1D4ED8] transition-colors"
                >
                  <span>{link.label}</span>
                  <span className="text-xs">Open</span>
                </Link>
              ))}
            </div>
            {organization && (
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                <span className="text-slate-500">Account Standing</span>
                <StatusLabel status={organization.accountStatus} />
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
