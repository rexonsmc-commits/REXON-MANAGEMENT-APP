import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ORG_STAFF_PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';

export function OrgStaffDashboard() {
  const { userProfile, organization, hasPermission } = useAuth();

  if (!userProfile) return null;

  const moduleCards = [
    {
      label: 'Property Overview',
      path: '/organization-staff/properties',
      perm: 'view_properties',
      desc: 'Inspect towers, wings, and flats inside your organization.',
    },
    {
      label: 'Towers & Wings',
      path: '/organization-staff/towers',
      perm: 'view_properties',
      desc: 'View or manage tower and wing directories.',
    },
    {
      label: 'Flats Directory',
      path: '/organization-staff/flats',
      perm: 'view_properties',
      desc: 'Access unit occupancy and owner/tenant details.',
    },
    {
      label: 'Staff Directory',
      path: '/organization-staff/staff',
      perm: 'view_staff',
      desc: 'View departmental colleagues and assignments.',
    },
    {
      label: 'Reports & PDFs',
      path: '/organization-staff/reports',
      perm: 'view_reports',
      desc: 'Review and export permitted organization reports.',
    },
  ].filter((m) => hasPermission(m.perm));

  return (
    <DashboardLayout
      title="Organization Staff Workspace"
      subtitle={`${organization?.name || userProfile.organizationName || 'Organization'} · ${userProfile.department || 'Staff'} (${userProfile.designation || 'Member'})`}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Your Assigned Organization Permissions
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Permissions are managed solely by your Organization Admin and enforced in Firestore.
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {ORG_STAFF_PERMISSIONS.map((perm) => {
              const enabled = hasPermission(perm.key);
              return (
                <div
                  key={perm.key}
                  className={`rounded-lg border p-3 text-xs ${
                    enabled
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{perm.label}</span>
                    <span>{enabled ? 'Enabled' : 'Restricted'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleCards.map((c) => (
            <Link
              key={c.path}
              to={c.path}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-[#1D4ED8] transition-colors"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">{c.label}</h3>
                <p className="mt-1.5 text-xs text-slate-600">{c.desc}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8]">
                <span>Open Module</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
