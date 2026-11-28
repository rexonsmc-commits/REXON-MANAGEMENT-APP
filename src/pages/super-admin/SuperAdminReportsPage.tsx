import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { StatusLabel } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { listOrganizations } from '../../services/organizations/organizationService';
import { listAllOrganizationStaffGlobal } from '../../services/staff/staffService';
import { listSubscriptions } from '../../services/subscriptions/subscriptionService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Organization, OrganizationStaff, Subscription } from '../../types';
import { DEMO_ORGANIZATIONS, DEMO_ORG_STAFF } from '../../utils/demoData';

export function SuperAdminReportsPage() {
  const { userProfile, firebaseUser, hasPermission } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgStaff, setOrgStaff] = useState<OrganizationStaff[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [demoPreview, setDemoPreview] = useState(false);

  const [selectedOrgId, setSelectedOrgId] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canExport = userProfile?.role === 'super_admin' || hasPermission('export_pdf');

  useEffect(() => {
    if (!userProfile || !firebaseUser) return;
    let active = true;
    Promise.all([
      listOrganizations().catch(() => []),
      listAllOrganizationStaffGlobal().catch(() => []),
      listSubscriptions().catch(() => []),
    ]).then(([o, s, sub]) => {
      if (!active) return;
      setOrgs(o);
      setOrgStaff(s);
      setSubs(sub);
      if (o.length === 0) setDemoPreview(true);
    });
    return () => {
      active = false;
    };
  }, [userProfile, firebaseUser]);

  const activeOrgs = demoPreview ? DEMO_ORGANIZATIONS : orgs;
  const activeStaff = demoPreview ? DEMO_ORG_STAFF : orgStaff;

  const filteredOrgs = useMemo(() => {
    return activeOrgs.filter((o) => {
      if (selectedOrgId !== 'all' && o.id !== selectedOrgId) return false;
      if (selectedYear !== 'all' && o.subscriptionStartDate && !o.subscriptionStartDate.startsWith(selectedYear)) {
        return false;
      }
      if (dateFrom && o.subscriptionStartDate && o.subscriptionStartDate < dateFrom) return false;
      if (dateTo && o.subscriptionStartDate && o.subscriptionStartDate > dateTo) return false;
      return true;
    });
  }, [activeOrgs, selectedOrgId, selectedYear, dateFrom, dateTo]);

  const filteredStaff = useMemo(() => {
    return activeStaff.filter((s) => selectedOrgId === 'all' || s.organizationId === selectedOrgId);
  }, [activeStaff, selectedOrgId]);

  const exportOrganizationsPdf = () => {
    exportTableToPdf({
      title: 'Global Organizations & Subscription Report',
      subtitle: `Filter: ${selectedOrgId === 'all' ? 'All Organizations' : selectedOrgId} | Year: ${selectedYear}`,
      generatedBy: userProfile?.email || 'Super Admin',
      columns: ['Organization', 'Type', 'Plan', 'Start Date', 'Expiry Date', 'Sub Status', 'Status'],
      rows: filteredOrgs.map((o) => [
        o.name,
        o.type,
        o.subscriptionPlanName || '—',
        o.subscriptionStartDate || '—',
        o.subscriptionExpiryDate || '—',
        o.subscriptionStatus,
        o.accountStatus,
      ]),
      filename: 'rexon-global-organizations-report',
    });
  };

  const exportStaffPdf = () => {
    exportTableToPdf({
      title: 'Organization Staff Directory Report',
      subtitle: `Organization Filter: ${selectedOrgId}`,
      generatedBy: userProfile?.email || 'Super Admin',
      columns: ['Employee ID', 'Name', 'Email', 'Department', 'Role', 'Status'],
      rows: filteredStaff.map((s) => [
        s.employeeId,
        s.name,
        s.email,
        s.department,
        s.role,
        s.status,
      ]),
      filename: 'rexon-global-staff-report',
    });
  };

  const exportSubscriptionsPdf = () => {
    exportTableToPdf({
      title: 'Platform Subscriptions Ledger Report',
      generatedBy: userProfile?.email || 'Super Admin',
      columns: ['Organization', 'Plan', 'Billing Cycle', 'Start', 'Expiry', 'Status'],
      rows: subs.map((sub) => [
        sub.organizationName || sub.organizationId,
        sub.planName,
        sub.billingCycle,
        sub.startDate,
        sub.expiryDate,
        sub.status,
      ]),
      filename: 'rexon-subscriptions-report',
    });
  };

  return (
    <DashboardLayout
      title="Global Reports & PDF Exports"
      subtitle="Filter platform records by organization, date range, and year, then generate audit-ready PDF reports."
    >
      <div className="space-y-6">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={orgs.length}
          label="organizations"
        />

        {/* Filters */}
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Organization</label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All Organizations</option>
              {activeOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Year Filter</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Export Cards */}
        {canExport && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <FileBarChart className="h-5 w-5 text-[#1D4ED8]" />
                <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                  Organization-Wise Report
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Includes organization type, contact owner, plan, and status ({filteredOrgs.length}{' '}
                  rows).
                </p>
              </div>
              <button
                type="button"
                onClick={exportOrganizationsPdf}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                <Download className="h-4 w-4" />
                <span>Download Organizations PDF</span>
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <FileBarChart className="h-5 w-5 text-[#1D4ED8]" />
                <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                  Organization Staff Report
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Staff IDs, departments, roles, and statuses ({filteredStaff.length} rows).
                </p>
              </div>
              <button
                type="button"
                onClick={exportStaffPdf}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                <span>Download Staff PDF</span>
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <FileBarChart className="h-5 w-5 text-[#1D4ED8]" />
                <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                  Subscription Verification Report
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Verified tenant subscription allocations ({subs.length} live records).
                </p>
              </div>
              <button
                type="button"
                onClick={exportSubscriptionsPdf}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                <span>Download Subscriptions PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Filtered Preview Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Filtered Report Preview ({filteredOrgs.length} organizations)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredOrgs.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{o.name}</td>
                    <td className="px-4 py-3 text-slate-600">{o.type}</td>
                    <td className="px-4 py-3 text-slate-700">{o.subscriptionPlanName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.subscriptionStartDate || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.subscriptionExpiryDate || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusLabel status={o.subscriptionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
