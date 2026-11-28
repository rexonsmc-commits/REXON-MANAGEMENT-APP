import { useEffect, useState } from 'react';
import { Database, Lock, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { firebaseProjectMetadata } from '../../services/firebase/config';
import { getSystemConfigMain } from '../../services/auth/authService';
import { listAuditLogs } from '../../services/subscriptions/subscriptionService';
import { AuditLog, SystemConfigMain } from '../../types';
import { BOOTSTRAPPED_SUPER_ADMIN_EMAIL } from '../../config/permissions';

export function SuperAdminSettingsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sysConfig, setSysConfig] = useState<SystemConfigMain | null>(null);

  useEffect(() => {
    Promise.all([
      listAuditLogs().catch(() => []),
      getSystemConfigMain().catch(() => null),
    ]).then(([auditData, configData]) => {
      setLogs(auditData);
      setSysConfig(configData);
      setLoadingLogs(false);
    });
  }, []);

  return (
    <DashboardLayout
      title="Platform Governance & Settings"
      subtitle="Firebase integration status, unique Super Admin invariant, account provisioning policy, and immutable audit logs."
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Database className="h-4 w-4 text-[#1D4ED8]" />
              <span>Firebase Project Readiness</span>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Project ID</dt>
                <dd className="font-mono text-slate-800">{firebaseProjectMetadata.projectId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Firestore DB</dt>
                <dd className="font-mono text-slate-800 truncate max-w-[170px]">
                  {firebaseProjectMetadata.databaseId}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Functions Mode</dt>
                <dd className="font-mono text-slate-800 truncate max-w-[170px]">
                  {firebaseProjectMetadata.cloudFunctionsMode}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">App Check</dt>
                <dd className="font-mono text-slate-800">
                  {firebaseProjectMetadata.appCheckEnabled ? 'Configured' : 'Optional / Unconfigured'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Unique Super Admin Invariant</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Enforced via <code className="font-mono text-slate-800">systemConfig/main</code> and{' '}
              <code className="font-mono text-slate-800">systemConfig/superAdmin</code> write-once
              singleton records. Master email:{' '}
              <strong className="text-slate-900">{BOOTSTRAPPED_SUPER_ADMIN_EMAIL}</strong>.
            </p>
            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold text-emerald-700">
                  {sysConfig?.initialized ? 'Initialized (Locked)' : 'Pending Bootstrap'}
                </dd>
              </div>
              {sysConfig?.superAdminUid && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Master UID</dt>
                  <dd className="font-mono text-slate-800 truncate max-w-[160px]">
                    {sysConfig.superAdminUid}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="h-4 w-4 text-[#1D4ED8]" />
              <span>Account Provisioning Policy</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Staff and Organization Admin accounts are provisioned via Firebase Cloud Functions
              (when deployed) and pre-authorized records in{' '}
              <code className="font-mono text-slate-800">invitedAccounts</code> and{' '}
              <code className="font-mono text-slate-800">loginDirectory</code> without altering the
              active Super Admin session.
            </p>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              Administrative Audit Logs (Append-Only)
            </h2>
            <p className="text-xs text-slate-500">
              Immutable Firestore log of administrative creations, updates, and subscription verifications.
            </p>
          </div>

          {loadingLogs ? (
            <div className="p-6 text-sm text-slate-500">Loading audit trail...</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No audit log entries recorded yet. Administrative actions will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.slice(0, 25).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1D4ED8]">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{log.actorEmail}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {log.targetCollection}/{log.targetId}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{log.summary}</td>
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
