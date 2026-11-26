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
  const isOrgAdmin = userProfile?.role === 'organization_admin';
  const isOrgStaff = userProfile?.role === 'organization_staff';
  const canExport = isOrgAdmin || hasPermission('export_pdf');

  const hasStaffAccess = isOrgAdmin || hasPermission('view_staff');
  const hasPropertyAccess = isOrgAdmin || hasPermission('view_properties');
  const onlyGeneralReports =
    !isOrgAdmin && hasPermission('view_reports') && !hasStaffAccess && !hasPropertyAccess;

  const allowStaffReport = isOrgAdmin || hasStaffAccess || onlyGeneralReports;
  const allowPropertyReports = isOrgAdmin || hasPropertyAccess || onlyGeneralReports;

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      allowStaffReport ? listOrganizationStaff(orgId).catch(() => []) : Promise.resolve([]),
      allowPropertyReports ? listTowers(orgId).catch(() => []) : Promise.resolve([]),
      allowPropertyReports ? listWings(orgId).catch(() => []) : Promise.resolve([]),
      allowPropertyReports ? listFlats(orgId).catch(() => []) : Promise.resolve([]),
    ]).then(([s, t, w, f]) => {
      setStaff(s);
      setTowers(t);
      setWings(w);
      setFlats(f);
      if (!isOrgStaff && s.length === 0 && t.length === 0 && f.length === 0) {
        setDemoPreview(true);
      }
    });
  }, [orgId, allowStaffReport, allowPropertyReports, isOrgStaff]);

  const effectiveDemo = !isOrgStaff && demoPreview;
  const activeStaff = effectiveDemo ? DEMO_ORG_STAFF : staff;
  const activeTowers = effectiveDemo ? DEMO_TOWERS : towers;
  const activeWings = effectiveDemo ? DEMO_WINGS : wings;
  const activeFlats = effectiveDemo ? DEMO_FLATS : flats;

  const reports = [
    ...(allowStaffReport
      ? [
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
        ]
      : []),
    ...(allowPropertyReports
      ? [
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
                rows: activeTowers.map((t) => [
                  t.towerNumber,
                  t.name,
                  t.description || '—',
                  t.status,
                ]),
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
                columns: [
                  'Flat No',
                  'Tower',
                  'Wing',
                  'Type',
                  'Owner',
                  'Occupancy',
                  'Tenant',
                  'Status',
                ],
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
        ]
      : []),
  ];

  return (
    <DashboardLayout
      title="Organization Reports & PDF Exports"
      subtitle="Export tenant-isolated staff and property directories to formatted PDF documents."
    >
      <div className="space-y-6">
        {!isOrgStaff && (
          <DemoDataBanner
            isDemoMode={demoPreview}
            onToggleDemo={() => setDemoPreview((p) => !p)}
            liveCount={staff.length + towers.length + wings.length + flats.length}
            label="organization records"
          />
        )}

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
