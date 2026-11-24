import { useEffect, useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { useAuth } from '../../context/AuthContext';
import { listFlats, listTowers, listWings } from '../../services/organizations/organizationService';
import { listOrganizationStaff } from '../../services/staff/staffService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { Flat, OrganizationStaff, Tower, Wing } from '../../types';
import { DEMO_FLATS, DEMO_ORG_STAFF, DEMO_TOWERS, DEMO_WINGS } from '../../utils/demoData';

export function OrgReportsPage() {
  const { userProfile, organization, hasPermission } = useAuth();
  const [staff, setStaff] = useState<OrganizationStaff[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [demoPreview, setDemoPreview] = useState(false);

  const orgId = userProfile?.organizationId || '';
  const orgName = organization?.name || userProfile?.organizationName || 'Organization';
  const canExport = userProfile?.role === 'organization_admin' || hasPermission('export_pdf');

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      listOrganizationStaff(orgId).catch(() => []),
      listTowers(orgId).catch(() => []),
      listWings(orgId).catch(() => []),
      listFlats(orgId).catch(() => []),
    ]).then(([s, t, w, f]) => {
      setStaff(s);
      setTowers(t);
      setWings(w);
      setFlats(f);
      if (s.length === 0 && t.length === 0 && f.length === 0) setDemoPreview(true);
    });
  }, [orgId]);

  const activeStaff = demoPreview ? DEMO_ORG_STAFF : staff;
  const activeTowers = demoPreview ? DEMO_TOWERS : towers;
  const activeWings = demoPreview ? DEMO_WINGS : wings;
  const activeFlats = demoPreview ? DEMO_FLATS : flats;

  const reports = [
    {
      title: 'Staff Directory Report',
      count: activeStaff.length,
      desc: 'Employee IDs, departments, designations, roles, and statuses.',
      onExport: () =>
        exportTableToPdf({
          title: 'Organization Staff Report',
          organizationName: orgName,
          generatedBy: userProfile?.email || 'Admin',
          columns: ['Emp ID', 'Name', 'Email', 'Department', 'Role', 'Status'],
          rows: activeStaff.map((s) => [
            s.employeeId,
            s.name,
            s.email,
            s.department,
            s.role,
            s.status,
          ]),
          filename: 'rexon-org-staff-report',
        }),
    },
    {
      title: 'Tower Directory Report',
      count: activeTowers.length,
      desc: 'Registered towers, tower numbers, and operational status.',
      onExport: () =>
        exportTableToPdf({
          title: 'Organization Towers Report',
          organizationName: orgName,
          generatedBy: userProfile?.email || 'Admin',
          columns: ['Tower No', 'Name', 'Description', 'Status'],
          rows: activeTowers.map((t) => [t.towerNumber, t.name, t.description || '—', t.status]),
          filename: 'rexon-org-towers-report',
        }),
    },
    {
      title: 'Wing Directory Report',
      count: activeWings.length,
      desc: 'Wings mapped to parent towers across the property.',
      onExport: () =>
        exportTableToPdf({
          title: 'Organization Wings Report',
          organizationName: orgName,
          generatedBy: userProfile?.email || 'Admin',
          columns: ['Wing', 'Parent Tower', 'Description', 'Status'],
          rows: activeWings.map((w) => [
            w.name,
            w.towerName || w.towerId,
            w.description || '—',
            w.status,
          ]),
          filename: 'rexon-org-wings-report',
        }),
    },
    {
      title: 'Flat & Occupancy Report',
      count: activeFlats.length,
      desc: 'Complete flat register with owner, tenant, and occupancy types.',
      onExport: () =>
        exportTableToPdf({
          title: 'Organization Flats & Occupancy Report',
          organizationName: orgName,
          generatedBy: userProfile?.email || 'Admin',
          columns: ['Flat No', 'Tower', 'Wing', 'Type', 'Owner', 'Occupancy', 'Tenant', 'Status'],
          rows: activeFlats.map((f) => [
            f.flatNumber,
            f.towerName || f.towerId,
            f.wingName || f.wingId,
            f.flatType,
            f.ownerName,
            f.occupancyType,
            f.tenantName || '—',
            f.status,
          ]),
          filename: 'rexon-org-flats-report',
        }),
    },
  ];

  return (
    <DashboardLayout
      title="Organization Reports & PDF Exports"
      subtitle="Export tenant-isolated staff and property directories to formatted PDF documents."
    >
      <div className="space-y-6">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={staff.length + towers.length + wings.length + flats.length}
          label="organization records"
        />

        <div className="grid gap-5 md:grid-cols-2">
          {reports.map((rep) => (
            <div
              key={rep.title}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <div>
                <div className="flex items-center justify-between">
                  <FileBarChart className="h-5 w-5 text-[#1D4ED8]" />
                  <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                    {rep.count} records
                  </span>
                </div>
                <h2 className="mt-4 font-display text-lg font-bold text-slate-900">{rep.title}</h2>
                <p className="mt-1.5 text-sm text-slate-600">{rep.desc}</p>
              </div>
              {canExport ? (
                <button
                  type="button"
                  onClick={rep.onExport}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  <Download className="h-4 w-4" />
                  <span>Export PDF Report</span>
                </button>
              ) : (
                <p className="mt-5 text-xs text-slate-400">
                  PDF export permission required from Organization Admin.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
