import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Plus, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ColumnDef, DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { DemoDataBanner } from '../../components/common/DemoDataBanner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { listOrganizations } from '../../services/organizations/organizationService';
import {
  createPaymentRecord,
  listAllSubscriptionPlans,
  listPayments,
  verifyPaymentAndActivateSubscription,
} from '../../services/subscriptions/subscriptionService';
import { exportTableToPdf } from '../../services/reports/pdfService';
import { BillingCycle, Organization, PaymentRecord, SubscriptionPlan } from '../../types';
import { DEMO_PAYMENTS, SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';

export function PaymentsPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(true);
  const [demoPreview, setDemoPreview] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [amount, setAmount] = useState('470');
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [payData, orgData, planData] = await Promise.all([
        listPayments(),
        listOrganizations().catch(() => []),
        listAllSubscriptionPlans().catch(() => []),
      ]);
      setPayments(payData);
      setOrgs(orgData);
      if (planData.length > 0) setPlans(planData);
    } catch (err) {
      showToast('Failed to load payments', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeData = demoPreview ? DEMO_PAYMENTS : payments;

  const filtered = useMemo(() => {
    return activeData.filter((p) => {
      const matchesSearch =
        !search.trim() ||
        p.organizationName.toLowerCase().includes(search.toLowerCase()) ||
        p.referenceCode.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.verificationStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeData, search, statusFilter]);

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !orgId || !planId || !referenceCode.trim()) return;

    const org = orgs.find((o) => o.id === orgId);
    const plan = plans.find((p) => p.id === planId);
    if (!org || !plan) return;

    setSaving(true);
    try {
      await createPaymentRecord(
        {
          organizationId: org.id,
          organizationName: org.name,
          planId: plan.id,
          planName: plan.name,
          amount: Number(amount) || 0,
          currency: 'USD',
          billingCycle,
          referenceCode,
          verificationStatus: 'Pending Verification',
          notes,
        },
        userProfile
      );
      showToast('Payment reference logged', 'success', 'Ready for Super Admin verification.');
      setModalOpen(false);
      setReferenceCode('');
      setNotes('');
      await loadData();
    } catch (err) {
      showToast('Failed to log record', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (payment: PaymentRecord, action: 'Verified' | 'Rejected') => {
    if (!userProfile) return;
    try {
      await verifyPaymentAndActivateSubscription(payment.id, action, userProfile);
      showToast(
        action === 'Verified' ? 'Payment Verified & Subscription Activated' : 'Payment Rejected',
        action === 'Verified' ? 'success' : 'info',
        payment.organizationName
      );
      await loadData();
    } catch (err) {
      showToast('Verification failed', 'error', err instanceof Error ? err.message : undefined);
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Subscription Payment Verification Ledger',
      generatedBy: userProfile?.email || 'Super Admin',
      columns: ['Organization', 'Plan', 'Cycle', 'Amount', 'Reference', 'Verification'],
      rows: filtered.map((p) => [
        p.organizationName,
        p.planName,
        p.billingCycle,
        `${p.currency} ${p.amount}`,
        p.referenceCode,
        p.verificationStatus,
      ]),
      filename: 'rexon-payments-ledger',
    });
  };

  const columns: ColumnDef<PaymentRecord>[] = [
    {
      key: 'org',
      header: 'Organization',
      sortable: true,
      sortValue: (p) => p.organizationName,
      render: (p) => (
        <div>
          <p className="font-semibold text-slate-900">{p.organizationName}</p>
          <p className="font-mono text-xs text-slate-500">{p.referenceCode}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan & Cycle',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-800">{p.planName}</p>
          <p className="text-xs capitalize text-slate-500">{p.billingCycle.replace('_', '-')}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => (
        <span className="font-mono font-semibold text-slate-900 tabular-nums">
          {p.currency} {p.amount}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Verification Status',
      render: (p) => <StatusLabel status={p.verificationStatus} />,
    },
    {
      key: 'actions',
      header: 'Super Admin Action',
      align: 'right',
      render: (p) =>
        demoPreview ? (
          <span className="text-xs text-slate-400">Preview only</span>
        ) : isSuperAdmin && p.verificationStatus === 'Pending Verification' ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleVerify(p, 'Verified')}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verify & Activate</span>
            </button>
            <button
              type="button"
              onClick={() => void handleVerify(p, 'Rejected')}
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Reject</span>
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-500">{p.verifiedBy || 'Recorded'}</span>
        ),
    },
  ];

  return (
    <DashboardLayout
      title="Subscription Payments & Verification"
      subtitle="Controlled administrative payment verification ledger. Subscriptions activate only upon Super Admin verification."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setOrgId(orgs[0]?.id || '');
                setPlanId(plans[0]?.id || '');
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Log Payment Reference</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <DemoDataBanner
          isDemoMode={demoPreview}
          onToggleDemo={() => setDemoPreview((p) => !p)}
          liveCount={payments.length}
          label="payment records"
        />

        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(p) => p.id}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization or reference code..."
          filters={[
            {
              key: 'status',
              label: 'Verification status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { label: 'All Statuses', value: 'all' },
                { label: 'Pending Verification', value: 'Pending Verification' },
                { label: 'Verified', value: 'Verified' },
                { label: 'Rejected', value: 'Rejected' },
              ],
            },
          ]}
          emptyTitle="No payment verification records"
          emptyDescription="Log verified bank transfers, invoices, or external gateway references here to activate tenant subscriptions securely."
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log Subscription Payment Reference"
        subtitle="Creates a pending verification entry. Super Admin must verify before tenant subscription activates."
      >
        <form onSubmit={(e) => void handleLogPayment(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Organization *</label>
            <select
              required
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select organization</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Plan *</label>
              <select
                required
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half-Yearly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Amount (USD) *</label>
              <input
                type="number"
                min={0}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Settlement / Invoice Reference *
              </label>
              <input
                type="text"
                required
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="INV-2026-001"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Verification Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
            >
              {saving ? 'Logging...' : 'Save Payment Reference'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
