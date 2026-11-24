import { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { listAuditLogs } from '../../services/subscriptions/subscriptionService';
import { AuditLog } from '../../types';

export function OrgSettingsPage() {
  const { userProfile, organization } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const orgId = userProfile?.organizationId || '';

  useEffect(() => {
    if (!orgId) return;
    listAuditLogs(orgId)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [orgId]);

  return (
    <DashboardLayout
      title="Organization Settings & Audit Logs"
      subtitle="Tenant security boundaries and organization-scoped administrative audit trail."
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="h-4 w-4 text-[#1D4ED8]" />
              <span>Tenant Isolation Boundary</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              All staff, role templates, towers, wings, and flats in this workspace are bound to{' '}
              <code className="font-mono text-slate-900">{orgId}</code> (
              {organization?.name || 'Your Organization'}). Cross-tenant access is blocked by
              Firestore Security Rules.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Staff Account Provisioning</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Staff created in Staff Management receive a pre-authorized invitation record in
              Firestore so they can authenticate via Firebase Auth without affecting your admin
              session.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              Organization Audit Trail
            </h2>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No organization audit entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.slice(0, 20).map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1D4ED8]">
                        {l.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{l.actorEmail}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{l.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
