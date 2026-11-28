import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  ImagePlus,
  IndianRupee,
  Plus,
  QrCode,
  Receipt,
  Upload,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatusLabel } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { DirectPaymentModal } from '../../components/common/DirectPaymentModal';
import { PdfExportModal, PdfFilterValues } from '../../components/common/PdfExportModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  attachPaymentProof,
  createPaymentRecord,
  getBillingContactConfig,
  listPayments,
  listPublicSubscriptionPlans,
} from '../../services/subscriptions/subscriptionService';
import { exportPaymentReceiptPdf, exportTableToPdf } from '../../services/reports/pdfService';
import {
  BillingContactConfig,
  BillingCycle,
  PaymentRecord,
  SubscriptionPlan,
} from '../../types';
import { SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';
import { compressImageFileToDataUrl, isSafeImageDataUrl } from '../../utils/imageHelpers';
import {
  formatCurrencyForPdf,
  formatDisplayDate,
  formatINR,
  matchesDateFilter,
} from '../../utils/subscriptionHelpers';

const PAYMENT_MODES = [
  'UPI QR (PhonePe / Paytm / GPay)',
  'UPI ID / Mobile Number',
  'Net Banking (NEFT / RTGS / IMPS)',
  'Cheque / Bank Deposit',
];

function getPlanAmount(plan: SubscriptionPlan | undefined, cycle: BillingCycle): number {
  if (!plan) return 0;
  switch (cycle) {
    case 'monthly':
      return plan.monthlyPrice;
    case 'quarterly':
      return plan.quarterlyPrice;
    case 'half_yearly':
      return plan.halfYearlyPrice;
    case 'yearly':
    default:
      return plan.yearlyPrice;
  }
}

export function OrgSubscriptionPage() {
  const { userProfile, firebaseUser, organization } = useAuth();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [billingContact, setBillingContact] = useState<BillingContactConfig | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_MODES[0]);
  const [amount, setAmount] = useState('13999');
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingProofId, setUploadingProofId] = useState<string | null>(null);
  const [proofModalPayment, setProofModalPayment] = useState<PaymentRecord | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<PaymentRecord | null>(null);

  const orgId = userProfile?.organizationId || '';

  const loadData = useCallback(async () => {
    if (!orgId || !userProfile || !firebaseUser) return;
    const [p, pl, bc] = await Promise.all([
      listPayments(orgId).catch(() => []),
      listPublicSubscriptionPlans().catch(() => []),
      getBillingContactConfig().catch(() => null),
    ]);
    setPayments(p);
    if (pl.length > 0) setPlans(pl);
    setBillingContact(bc);
  }, [orgId, userProfile, firebaseUser]);

  useEffect(() => {
    if (!orgId || !userProfile || !firebaseUser) return;
    void loadData();
  }, [loadData, orgId, userProfile, firebaseUser]);

  const openSubmitModal = () => {
    const defaultPlan =
      plans.find((p) => p.id === organization?.subscriptionPlanId) || plans[0];
    setPlanId(defaultPlan?.id || '');
    setBillingCycle('yearly');
    setPaymentMethod(PAYMENT_MODES[0]);
    setAmount(String(getPlanAmount(defaultPlan, 'yearly') || 13999));
    setPaymentProofDataUrl('');
    setModalOpen(true);
  };

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    const selected = plans.find((p) => p.id === nextPlanId);
    if (selected) {
      setAmount(String(getPlanAmount(selected, billingCycle)));
    }
  };

  const handleCycleChange = (nextCycle: BillingCycle) => {
    setBillingCycle(nextCycle);
    const selected = plans.find((p) => p.id === planId);
    if (selected) {
      setAmount(String(getPlanAmount(selected, nextCycle)));
    }
  };

  const handleFormProofSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxDim: 960, maxChars: 380000 });
      setPaymentProofDataUrl(dataUrl);
      showToast('Payment proof screenshot ready', 'success');
    } catch (err) {
      showToast(
        'Could not process image',
        'error',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleUploadProofForPayment = async (
    payment: PaymentRecord,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userProfile) return;
    setUploadingProofId(payment.id);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxDim: 960, maxChars: 380000 });
      await attachPaymentProof(payment.id, dataUrl, userProfile);
      showToast(
        'Payment proof uploaded',
        'success',
        'Super Admin can now view your screenshot in Payments.'
      );
      if (latestReceipt?.id === payment.id) {
        setLatestReceipt({ ...latestReceipt, paymentProofDataUrl: dataUrl });
      }
      if (proofModalPayment?.id === payment.id) {
        setProofModalPayment({ ...proofModalPayment, paymentProofDataUrl: dataUrl });
      }
      await loadData();
    } catch (err) {
      showToast(
        'Failed to upload payment proof',
        'error',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setUploadingProofId(null);
    }
  };

  const handleSubmitReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !organization || !planId || !referenceCode.trim()) return;
    const selectedPlan = plans.find((p) => p.id === planId);
    if (!selectedPlan) return;

    setSaving(true);
    try {
      const created = await createPaymentRecord(
        {
          organizationId: organization.id,
          organizationName: organization.name,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: Number(amount) || 0,
          currency: 'INR',
          billingCycle,
          paymentMethod,
          paymentProofDataUrl: paymentProofDataUrl || undefined,
          referenceCode,
          verificationStatus: 'Pending Verification',
          notes,
        },
        userProfile
      );
      setLatestReceipt(created);
      showToast(
        'Payment reference submitted',
        'success',
        'Your official receipt PDF is ready and visible to Super Admin.'
      );
      setModalOpen(false);
      setReferenceCode('');
      setNotes('');
      setPaymentProofDataUrl('');
      await loadData();
    } catch (err) {
      showToast('Submission failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const filterPaymentsForPdf = (filters: PdfFilterValues) => {
    return payments.filter((p) => {
      if (filters.dateFilter.mode !== 'all' && !matchesDateFilter(p.createdAt, filters.dateFilter)) {
        return false;
      }
      if (filters.extraFilter !== 'all' && p.verificationStatus !== filters.extraFilter) {
        return false;
      }
      return true;
    });
  };

  const handleExportPdf = (filters: PdfFilterValues, filterSummary: string) => {
    const rowsData = filterPaymentsForPdf(filters);
    exportTableToPdf({
      title: 'Subscription Payment Statement (INR)',
      subtitle: `${organization?.name || 'Company / Society'}  |  ${filterSummary}`,
      organizationName: organization?.name || userProfile?.organizationName,
      generatedBy: userProfile?.email || 'Company / Society Admin',
      columns: ['Date', 'Reference', 'Mode', 'Plan', 'Cycle', 'Amount (INR)', 'Status'],
      rows: rowsData.map((p) => [
        formatDisplayDate(p.createdAt),
        p.referenceCode,
        p.paymentMethod || 'Direct',
        p.planName,
        p.billingCycle.replace('_', '-'),
        formatCurrencyForPdf(p.amount, 'INR'),
        p.verificationStatus,
      ]),
      filename: 'rexon-subscription-payments',
    });
  };

  return (
    <DashboardLayout
      title="Subscription & Billing Status"
      subtitle="Pay directly via UPI QR (PhonePe / Paytm / GPay), Net Banking, or Billing Helpline in INR (₹), submit your UTR reference, and download your payment receipt PDF."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setPayModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
          >
            <QrCode className="h-4 w-4" />
            <span>Pay Now (UPI QR / Bank)</span>
          </button>
          <button
            type="button"
            onClick={openSubmitModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Submit Payment Reference</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {latestReceipt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="flex items-start gap-2.5 text-xs text-emerald-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  Payment Submitted — Receipt Ready ({latestReceipt.receiptNumber})
                </p>
                <p className="mt-0.5 text-emerald-800">
                  {latestReceipt.planName} · {formatINR(latestReceipt.amount)} · UTR:{' '}
                  <strong className="font-mono">{latestReceipt.referenceCode}</strong>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {uploadingProofId === latestReceipt.id
                    ? 'Uploading...'
                    : latestReceipt.paymentProofDataUrl
                      ? 'Update Payment Proof'
                      : 'Upload Payment Proof'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  disabled={uploadingProofId === latestReceipt.id}
                  onChange={(e) => void handleUploadProofForPayment(latestReceipt, e)}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={() => exportPaymentReceiptPdf(latestReceipt, organization, billingContact)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Receipt PDF</span>
              </button>
            </div>
          </div>
        )}

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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#1D4ED8]" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Submitted Payment Verification Records &amp; Receipts
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Statement PDF</span>
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No payment verification references submitted yet. Click &ldquo;Pay Now (UPI QR / Bank)&rdquo;
              or submit an invoice / UTR reference to download your payment receipt.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference &amp; Mode</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Cycle</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment Proof</th>
                    <th className="px-4 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {formatDisplayDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {p.referenceCode}
                        </p>
                        {p.paymentMethod && (
                          <p className="text-[11px] text-slate-500">{p.paymentMethod}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.planName}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {p.billingCycle.replace('_', '-')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {formatINR(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={p.verificationStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isSafeImageDataUrl(p.paymentProofDataUrl) ? (
                            <button
                              type="button"
                              onClick={() => setProofModalPayment(p)}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View Proof</span>
                            </button>
                          ) : p.verificationStatus === 'Pending Verification' ? (
                            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                              <Upload className="h-3.5 w-3.5" />
                              <span>
                                {uploadingProofId === p.id ? 'Uploading...' : 'Upload Proof'}
                              </span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                disabled={uploadingProofId === p.id}
                                onChange={(e) => void handleUploadProofForPayment(p, e)}
                                className="sr-only"
                              />
                            </label>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => exportPaymentReceiptPdf(p, organization, billingContact)}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-100"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Download Receipt</span>
                        </button>
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
        subtitle="Creates an official payment receipt PDF immediately. Super Admin verifies settlement before subscription activates."
      >
        <form onSubmit={(e) => void handleSubmitReference(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Plan *</label>
              <select
                required
                value={planId}
                onChange={(e) => handlePlanChange(e.target.value)}
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
                onChange={(e) => handleCycleChange(e.target.value as BillingCycle)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half-Yearly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Payment Mode</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Amount (₹ / INR) *
              </label>
              <div className="relative mt-1">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min={0}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Transaction / UTR / Invoice Ref *
              </label>
              <input
                type="text"
                required
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="e.g. 429812345678"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Upload Payment Proof (Screenshot / Receipt Photo)
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              {isSafeImageDataUrl(paymentProofDataUrl) ? (
                <img
                  src={paymentProofDataUrl}
                  alt="Payment proof preview"
                  className="h-16 w-16 rounded-md border border-slate-200 object-cover bg-white"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{paymentProofDataUrl ? 'Change Screenshot' : 'Upload Payment Proof'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => void handleFormProofSelect(e)}
                    className="sr-only"
                  />
                </label>
                {paymentProofDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPaymentProofDataUrl('')}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
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
              {saving ? 'Submitting...' : 'Submit & Generate Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(proofModalPayment)}
        onClose={() => setProofModalPayment(null)}
        title="Uploaded Payment Proof"
        subtitle={
          proofModalPayment
            ? `Ref: ${proofModalPayment.referenceCode} · ${formatINR(proofModalPayment.amount)}`
            : undefined
        }
        maxWidth="lg"
      >
        {proofModalPayment && (
          <div className="space-y-4">
            {isSafeImageDataUrl(proofModalPayment.paymentProofDataUrl) ? (
              <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={proofModalPayment.paymentProofDataUrl}
                  alt={`Payment proof for ${proofModalPayment.referenceCode}`}
                  className="max-h-[60vh] w-auto rounded-lg object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">No payment proof uploaded yet.</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {proofModalPayment.verificationStatus === 'Pending Verification' ? (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  <span>
                    {uploadingProofId === proofModalPayment.id
                      ? 'Uploading...'
                      : 'Replace Payment Proof'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    disabled={uploadingProofId === proofModalPayment.id}
                    onChange={(e) => void handleUploadProofForPayment(proofModalPayment, e)}
                    className="sr-only"
                  />
                </label>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setProofModalPayment(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Export Subscription Payment PDF (INR)"
        description="Filter your subscription payment records by Month, Date Range, Year, or Verification Status."
        extraFilterLabel="Verification Status"
        extraFilterOptions={[
          { label: 'All Statuses', value: 'all' },
          { label: 'Pending Verification', value: 'Pending Verification' },
          { label: 'Verified', value: 'Verified' },
          { label: 'Rejected', value: 'Rejected' },
        ]}
        getMatchCount={(f) => filterPaymentsForPdf(f).length}
        onExport={handleExportPdf}
      />

      <DirectPaymentModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        organization={organization}
        canSubmitReference
        onNavigateSubmitReference={openSubmitModal}
        onPaymentSubmitted={() => void loadData()}
      />
    </DashboardLayout>
  );
}
