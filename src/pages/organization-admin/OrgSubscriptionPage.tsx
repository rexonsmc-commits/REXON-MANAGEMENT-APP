import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatusLabel } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createPaymentRecord,
  listPayments,
  listPublicSubscriptionPlans,
} from '../../services/subscriptions/subscriptionService';
import { BillingCycle, PaymentRecord, SubscriptionPlan } from '../../types';
import { SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';

export function OrgSubscriptionPage() {
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [modalOpen, setModalOpen] = useState(false);

  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [amount, setAmount] = useState('470');
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const orgId = userProfile?.organizationId || '';

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const [p, pl] = await Promise.all([
      listPayments(orgId).catch(() => []),
      listPublicSubscriptionPlans().catch(() => []),
    ]);
    setPayments(p);
    if (pl.length > 0) setPlans(pl);
  }, [orgId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmitReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !organization || !planId || !referenceCode.trim()) return;
    const selectedPlan = plans.find((p) => p.id === planId);
    if (!selectedPlan) return;

    setSaving(true);
    try {
      await createPaymentRecord(
        {
          organizationId: organization.id,
          organizationName: organization.name,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: Number(amount) || 0,
          currency: 'USD',
          billingCycle,
          referenceCode,
          verificationStatus: 'Pending Verification',
          notes,
        },
        userProfile
      );
      showToast(
        'Payment reference submitted',
        'success',
        'Awaiting Super Admin verification before subscription status changes.'
      );
      setModalOpen(false);
      setReferenceCode('');
      setNotes('');
      await loadData();
    } catch (err) {
      showToast('Submission failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Subscription & Billing Status"
      subtitle="View your current subscription standing. Activations and renewals are verified by Super Admin."
      actions={
        <button
          type="button"
          onClick={() => {
            setPlanId(plans[0]?.id || '');
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Submit Payment Reference</span>
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Current Plan</p>
            <p className="mt-1 font-display text-lg font-bold text-slate-900">
              {organization?.subscriptionPlanName || 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Subscription Status</p>
            <div className="mt-1.5">
              <StatusLabel status={organization?.subscriptionStatus || 'Pending'} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Start Date</p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900 tabular-nums">
              {organization?.subscriptionStartDate || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Expiry Date</p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900 tabular-nums">
              {organization?.subscriptionExpiryDate || '—'}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <CreditCard className="h-4 w-4 text-[#1D4ED8]" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Submitted Payment Verification Records
            </h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No payment verification references submitted yet. Submit an invoice or bank
              transfer reference for Super Admin verification.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Cycle</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                        {p.referenceCode}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.planName}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {p.billingCycle.replace('_', '-')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                        {p.currency} {p.amount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={p.verificationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Submit Payment Reference for Verification"
        subtitle="Does not auto-activate subscription. Super Admin verifies settlement before activation."
      >
        <form onSubmit={(e) => void handleSubmitReference(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Plan *</label>
              <select
                required
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select plan...</option>
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
                Transaction / Invoice Ref *
              </label>
              <input
                type="text"
                required
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
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
              {saving ? 'Submitting...' : 'Submit for Verification'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
