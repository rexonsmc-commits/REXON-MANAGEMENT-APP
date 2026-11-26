import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SUPER_ADMIN_STAFF_PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';

export function SuperAdminStaffDashboard() {
  const { userProfile, hasPermission } = useAuth();

  if (!userProfile) return null;

  const quickLinks = [
    {
      label: 'Manage Company / Society',
      path: '/super-admin-staff/organizations',
      perm: 'manage_organizations',
      desc: 'View and update assigned company & society workspaces.',
    },
    {
      label: 'Subscription Plans',
      path: '/super-admin-staff/plans',
      perm: 'manage_plans',
      desc: 'Manage platform subscription tiers and limits.',
    },
    {
      label: 'Payments Ledger',
      path: '/super-admin-staff/payments',
      perm: 'view_payments',
      desc: 'Review payment verification records.',
    },
    {
      label: 'Global Reports',
      path: '/super-admin-staff/reports',
      perm: 'manage_reports',
      desc: 'Filter records and generate PDF exports.',
    },
  ].filter((q) => hasPermission(q.perm));

  return (
    <DashboardLayout
      title="Super Admin Staff Workspace"
      subtitle={`Welcome, ${userProfile.displayName}. Your access is scoped strictly to permissions granted by Super Admin.`}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Assigned Platform Permissions
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Designation: {userProfile.designation || 'Staff'} · Department:{' '}
            {userProfile.department || 'Operations'}
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {SUPER_ADMIN_STAFF_PERMISSIONS.map((perm) => {
              const granted = hasPermission(perm.key);
              return (
                <div
                  key={perm.key}
                  className={`rounded-lg border p-3 text-xs ${
                    granted
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{perm.label}</span>
                    <span>{granted ? 'Enabled' : 'Restricted'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-[#1D4ED8] transition-colors"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">{item.label}</h3>
                <p className="mt-1.5 text-xs text-slate-600">{item.desc}</p>
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
