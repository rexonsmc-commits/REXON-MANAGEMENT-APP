import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileBarChart,
  Plus,
  Users,
  XCircle,
} from 'lucide-react';
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
import { listOrganizations } from '../../services/organizations/organizationService';
import { listAllOrganizationStaffGlobal, listSuperAdminStaff } from '../../services/staff/staffService';
import { listContactMessages } from '../../services/subscriptions/subscriptionService';
import { ContactMessage, Organization } from '../../types';
import { DEMO_ORGANIZATIONS, DEMO_SUPER_ADMIN_STAFF } from '../../utils/demoData';
import {
  getSubscriptionExpiryInfo,
  sortOrganizationsByExpiry,
} from '../../utils/subscriptionHelpers';

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { userProfile, hasPermission, isSuperAdmin } = useAuth();
  const [liveOrgs, setLiveOrgs] = useState<Organization[]>([]);
  const [liveStaffCount, setLiveStaffCount] = useState(0);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!userProfile) return;
      setLoading(true);
      const isSA = userProfile.role === 'super_admin';
      try {
        const [orgs, saStaff, orgStaff, msgs] = await Promise.all([
          isSA || hasPermission('manage_organizations') || hasPermission('view_dashboard')
            ? listOrganizations().catch(() => [])
            : Promise.resolve([]),
          isSA || hasPermission('manage_staff')
            ? listSuperAdminStaff().catch(() => [])
            : Promise.resolve([]),
          isSA || hasPermission('manage_organizations') || hasPermission('manage_reports')
            ? listAllOrganizationStaffGlobal().catch(() => [])
            : Promise.resolve([]),
          isSA || hasPermission('manage_reports') || hasPermission('view_dashboard')
            ? listContactMessages().catch(() => [])
            : Promise.resolve([]),
        ]);
        if (!active) return;
        setLiveOrgs(orgs);
        setLiveStaffCount(saStaff.length + orgStaff.length);
        setMessages(msgs);
        if (orgs.length === 0) {
          setDemoPreview(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userProfile, hasPermission]);

  const orgs = useMemo(
    () => sortOrganizationsByExpiry(demoPreview ? DEMO_ORGANIZATIONS : liveOrgs),
    [demoPreview, liveOrgs]
  );
  const staffCount = demoPreview ? DEMO_SUPER_ADMIN_STAFF.length + 14 : liveStaffCount;

  const metrics = useMemo(() => {
    const totalOrgs = orgs.length;
    const activeOrgs = orgs.filter((o) => o.accountStatus === 'active').length;
    const inactiveOrgs = orgs.filter((o) => o.accountStatus !== 'active').length;
    const activeSubs = orgs.filter((o) => o.subscriptionStatus === 'Active').length;
    const expiredSubs = orgs.filter((o) => o.subscriptionStatus === 'Expired').length;
    return { totalOrgs, activeOrgs, inactiveOrgs, activeSubs, expiredSubs };
  }, [orgs]);

  const orgTypeChart = useMemo(() => {
    const counts: Record<string, number> = {
      Company: 0,
      Factory: 0,
      Society: 0,
      Apartment: 0,
      Industry: 0,
      Other: 0,
    };
    orgs.forEach((o) => {
      counts[o.type] = (counts[o.type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }, [orgs]);

  const subStatusChart = useMemo(() => {
    const statuses = ['Active', 'Pending', 'Expired', 'Suspended', 'Cancelled'];
    return statuses.map((st) => ({
      status: st,
      count: orgs.filter((o) => o.subscriptionStatus === st).length,
    }));
  }, [orgs]);

  const basePrefix =
    userProfile?.role === 'super_admin_staff' ? '/super-admin-staff' : '/super-admin';

  return (
    <DashboardLayout
      title="Platform Overview Dashboard"
      subtitle="Centralized multi-tenant governance across organizations, subscriptions, and global staff."
      actions={
        (userProfile?.role === 'super_admin' || hasPermission('create_organizations')) && (
          <Link
            to={`${basePrefix}/organizations`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Manage Company / Society</span>
          </Link>
        )
      }
    >
      <div className="space-y-6">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={liveOrgs.length}
          label="organizations"
        />

        {/* 6 Required KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            title="Total Organizations"
            value={loading ? '...' : metrics.totalOrgs}
            icon={<Building2 className="h-5 w-5" />}
            tone="blue"
          />
          <KpiCard
            title="Active Organizations"
            value={loading ? '...' : metrics.activeOrgs}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="emerald"
          />
          <KpiCard
            title="Inactive Organizations"
            value={loading ? '...' : metrics.inactiveOrgs}
            icon={<XCircle className="h-5 w-5" />}
            tone="default"
          />
          <KpiCard
            title="Total Staff"
            value={loading ? '...' : staffCount}
            icon={<Users className="h-5 w-5" />}
            tone="blue"
          />
          <KpiCard
            title="Active Subscriptions"
            value={loading ? '...' : metrics.activeSubs}
            icon={<CreditCard className="h-5 w-5" />}
            tone="emerald"
          />
          <KpiCard
            title="Expired Subscriptions"
            value={loading ? '...' : metrics.expiredSubs}
            icon={<Clock className="h-5 w-5" />}
            tone="rose"
          />
        </div>

        {/* Analytics Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Organizations by Category
                </h2>
                <p className="text-xs text-slate-500">
                  Distribution across Companies, Factories, Societies & Industries
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {demoPreview ? 'Demo Preview' : 'Live'}
              </span>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orgTypeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Subscription Lifecycle Status
                </h2>
                <p className="text-xs text-slate-500">
                  Verification and renewal breakdown across registered tenants
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {demoPreview ? 'Demo Preview' : 'Live'}
              </span>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subStatusChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0B192C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Organizations & Contact Inquiries */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-display text-base font-bold text-slate-900">
                Registered Organizations Snapshot
              </h2>
              <Link
                to={`${basePrefix}/organizations`}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Subscription</th>
                    <th className="px-4 py-3">Account</th>
                    {isSuperAdmin() && <th className="px-4 py-3 text-right">Portal</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orgs.slice(0, 5).map((org) => {
                    const info = getSubscriptionExpiryInfo(org);
                    return (
                      <tr key={org.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{org.name}</p>
                          {(info.urgency === 'expired' || info.urgency === 'expiring_soon') && (
                            <span
                              className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                info.urgency === 'expired'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {info.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{org.type}</td>
                        <td className="px-4 py-3">
                          <StatusLabel status={org.subscriptionStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusLabel status={org.accountStatus} />
                            {org.isHidden && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                                Hidden
                              </span>
                            )}
                          </div>
                        </td>
                        {isSuperAdmin() && (
                          <td className="px-4 py-3 text-right">
                            {!demoPreview ? (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/organization-admin/dashboard?orgId=${encodeURIComponent(org.id)}`,
                                    { state: { inspectOrg: org } }
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View Details</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Demo</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {orgs.length === 0 && (
                    <tr>
                      <td
                        colSpan={isSuperAdmin() ? 5 : 4}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No live organizations provisioned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-display text-base font-bold text-slate-900">
                Public Onboarding Inquiries
              </h2>
              <FileBarChart className="h-4 w-4 text-slate-400" />
            </div>
            <div className="divide-y divide-slate-100">
              {messages.slice(0, 4).map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.subject}</p>
                    <StatusLabel status={m.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.name} {m.companyName ? `· ${m.companyName}` : ''} · {m.email}
                  </p>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No contact form inquiries logged yet. Submissions from the public Contact Us page
                  appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
