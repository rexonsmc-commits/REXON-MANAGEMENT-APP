import { ChangeEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ImagePlus,
  IndianRupee,
  Landmark,
  Mail,
  Phone,
  QrCode,
  Receipt,
  ShieldAlert,
  Smartphone,
  Upload,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from './Modal';
import {
  BillingContactConfig,
  BillingCycle,
  Organization,
  PaymentRecord,
  SubscriptionPlan,
} from '../../types';
import {
  attachPaymentProof,
  createPaymentRecord,
  getBillingContactConfig,
  listPublicSubscriptionPlans,
} from '../../services/subscriptions/subscriptionService';
import { exportPaymentReceiptPdf } from '../../services/reports/pdfService';
import { compressImageFileToDataUrl, isSafeImageDataUrl } from '../../utils/imageHelpers';
import { getSubscriptionExpiryInfo, formatINR } from '../../utils/subscriptionHelpers';
import { SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface DirectPaymentModalProps {
  open: boolean;
  onClose: () => void;
  organization?: Organization | null;
  canSubmitReference?: boolean;
  onNavigateSubmitReference?: () => void;
  onPaymentSubmitted?: () => void;
}

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

export function DirectPaymentModal({
  open,
  onClose,
  organization,
  canSubmitReference = false,
  onNavigateSubmitReference,
  onPaymentSubmitted,
}: DirectPaymentModalProps) {
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [contact, setContact] = useState<BillingContactConfig | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(false);

  // Inline payment confirmation & instant receipt state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_MODES[0]);
  const [amount, setAmount] = useState('13999');
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setSubmittedReceipt(null);
    setShowSubmitForm(false);
    setReferenceCode('');
    setNotes('');
    setPaymentProofDataUrl('');

    Promise.all([
      getBillingContactConfig().catch(() => null),
      canSubmitReference ? listPublicSubscriptionPlans().catch(() => []) : Promise.resolve([]),
    ])
      .then(([cfg, loadedPlans]) => {
        if (!active) return;
        setContact(cfg);
        const availablePlans = loadedPlans.length > 0 ? loadedPlans : SAMPLE_SUBSCRIPTION_PLANS;
        setPlans(availablePlans);
        const matchedPlan =
          availablePlans.find((p) => p.id === organization?.subscriptionPlanId) ||
          availablePlans[0];
        if (matchedPlan) {
          setPlanId(matchedPlan.id);
          setAmount(String(getPlanAmount(matchedPlan, 'yearly')));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, canSubmitReference, organization?.subscriptionPlanId]);

  const expiryInfo = getSubscriptionExpiryInfo(organization);

  const handleCopy = async (label: string, value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied`, 'success', value);
    } catch {
      showToast('Copy failed', 'error');
    }
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

  const handleProofFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxDim: 960, maxChars: 380000 });
      setPaymentProofDataUrl(dataUrl);
      showToast('Payment proof image ready', 'success');
    } catch (err) {
      showToast(
        'Could not process payment proof',
        'error',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleAttachProofAfterSubmit = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !submittedReceipt || !userProfile) return;
    setUploadingProof(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxDim: 960, maxChars: 380000 });
      await attachPaymentProof(submittedReceipt.id, dataUrl, userProfile);
      setSubmittedReceipt({ ...submittedReceipt, paymentProofDataUrl: dataUrl });
      showToast('Payment proof uploaded', 'success', 'Visible to Super Admin for verification.');
      onPaymentSubmitted?.();
    } catch (err) {
      showToast(
        'Proof upload failed',
        'error',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setUploadingProof(false);
    }
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !organization || !planId || !referenceCode.trim()) return;
    const selectedPlan = plans.find((p) => p.id === planId);
    if (!selectedPlan) return;

    setSubmitting(true);
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
      setSubmittedReceipt(created);
      setShowSubmitForm(false);
      showToast(
        'Payment recorded & receipt ready',
        'success',
        'You can download your PDF receipt or upload payment proof below.'
      );
      onPaymentSubmitted?.();
    } catch (err) {
      showToast('Submission failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const safeQrSrc =
    contact?.qrCodeDataUrl && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(contact.qrCodeDataUrl)
      ? contact.qrCodeDataUrl
      : '';

  const hasUpiDetails = Boolean(safeQrSrc || contact?.upiId || contact?.upiNumber);
  const hasBankDetails = Boolean(
    contact?.bankName || contact?.accountNumber || contact?.ifscCode || contact?.accountHolderName
  );
  const hasAnyPaymentConfig = Boolean(
    contact && (contact.supportPhone || hasUpiDetails || hasBankDetails)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Subscription Renewal & Direct Payment (INR / ₹)"
      subtitle="Pay directly via UPI QR (PhonePe / Paytm / GPay), UPI ID, Net Banking, or Billing Helpline, then submit your UTR reference and download your receipt."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">
                {organization?.name || 'Your Organization'} — {expiryInfo.label}
              </p>
              <p className="mt-1 leading-relaxed text-amber-900">
                Current Plan: <strong>{organization?.subscriptionPlanName || 'Standard'}</strong> ·
                Expiry Date:{' '}
                <strong className="font-mono">
                  {organization?.subscriptionExpiryDate || 'Not set'}
                </strong>
                . Pay via any option below and submit your UTR / Transaction Reference to generate
                your official PDF payment receipt.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            Loading official payment details...
          </div>
        ) : hasAnyPaymentConfig && contact ? (
          <div className="space-y-4">
            {/* UPI QR + UPI ID / Number + Net Banking Grid */}
            {(hasUpiDetails || hasBankDetails) && (
              <div className="grid gap-4 md:grid-cols-2">
                {hasUpiDetails && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-purple-900">
                        <Smartphone className="h-4 w-4 text-purple-700" />
                        <span>UPI / PhonePe / Paytm / GPay</span>
                      </div>
                      {safeQrSrc && (
                        <a
                          href={safeQrSrc}
                          download="rexon-upi-payment-qr.png"
                          className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-white px-2 py-1 text-[11px] font-semibold text-purple-800 hover:bg-purple-50"
                        >
                          <Download className="h-3 w-3" />
                          <span>Save QR</span>
                        </a>
                      )}
                    </div>

                    {safeQrSrc && (
                      <div className="mt-3 flex flex-col items-center rounded-lg border border-purple-100 bg-white p-3">
                        <img
                          src={safeQrSrc}
                          alt="Scan QR to Pay via PhonePe, Paytm, GPay or UPI"
                          className="h-44 w-44 object-contain"
                        />
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                          <QrCode className="h-3.5 w-3.5 text-purple-700" />
                          <span>Scan with PhonePe · Paytm · Google Pay · BHIM</span>
                        </span>
                      </div>
                    )}

                    <div className="mt-3 space-y-2 text-xs">
                      {contact.upiPayeeName && (
                        <div className="rounded-lg border border-purple-100 bg-white px-3 py-2">
                          <span className="text-[11px] text-slate-500">Payee Name</span>
                          <p className="font-semibold text-slate-900">{contact.upiPayeeName}</p>
                        </div>
                      )}
                      {contact.upiId && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-purple-100 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-[11px] text-slate-500">UPI ID</span>
                            <p className="truncate font-mono font-semibold text-slate-900">
                              {contact.upiId}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopy('UPI ID', contact.upiId)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      )}
                      {contact.upiNumber && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-purple-100 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-[11px] text-slate-500">
                              PhonePe / Paytm / GPay Number
                            </span>
                            <p className="font-mono font-semibold text-slate-900">
                              {contact.upiNumber}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopy('UPI Number', contact.upiNumber)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {hasBankDetails && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-900">
                      <Landmark className="h-4 w-4 text-emerald-700" />
                      <span>Net Banking / NEFT / RTGS / IMPS</span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      {contact.bankName && (
                        <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                          <span className="text-[11px] text-slate-500">Bank Name</span>
                          <p className="font-semibold text-slate-900">{contact.bankName}</p>
                        </div>
                      )}
                      {contact.accountHolderName && (
                        <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                          <span className="text-[11px] text-slate-500">Account Holder</span>
                          <p className="font-semibold text-slate-900">
                            {contact.accountHolderName}
                          </p>
                        </div>
                      )}
                      {contact.accountNumber && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-[11px] text-slate-500">Account Number</span>
                            <p className="font-mono font-semibold text-slate-900">
                              {contact.accountNumber}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopy('Account Number', contact.accountNumber)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      )}
                      {contact.ifscCode && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-[11px] text-slate-500">IFSC Code</span>
                            <p className="font-mono font-semibold text-slate-900">
                              {contact.ifscCode}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopy('IFSC Code', contact.ifscCode)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      )}
                      {contact.bankBranch && (
                        <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                          <span className="text-[11px] text-slate-500">Branch</span>
                          <p className="font-medium text-slate-800">{contact.bankBranch}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Helpline & Payment Instructions */}
            {contact.supportPhone && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8]">
                      Direct Payment &amp; Renewal Helpline
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Phone className="h-5 w-5 text-[#1D4ED8]" />
                      <a
                        href={`tel:${contact.supportPhone.replace(/\s+/g, '')}`}
                        className="font-mono text-xl font-bold text-slate-900 hover:text-[#1D4ED8]"
                      >
                        {contact.supportPhone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${contact.supportPhone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Call Now</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopy('Support Phone', contact.supportPhone)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>

                {(contact.contactPersonName || contact.supportEmail) && (
                  <div className="grid gap-2 border-t border-blue-200/70 pt-3 text-xs text-slate-700 sm:grid-cols-2">
                    {contact.contactPersonName && (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        <span>
                          Contact Desk: <strong>{contact.contactPersonName}</strong>
                        </span>
                      </div>
                    )}
                    {contact.supportEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-500" />
                        <span>{contact.supportEmail}</span>
                      </div>
                    )}
                  </div>
                )}

                {contact.paymentInstructions && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700">
                    <p className="font-semibold text-slate-900">Payment &amp; Renewal Instructions:</p>
                    <p className="mt-1 whitespace-pre-line">{contact.paymentInstructions}</p>
                    {contact.upiOrBankNote && (
                      <p className="mt-2 border-t border-slate-100 pt-2 font-mono text-[11px] text-slate-600">
                        {contact.upiOrBankNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">
              Platform Direct Payment Details Not Yet Configured
            </p>
            <p className="mt-1 text-slate-600">
              Your Super Admin has not added UPI QR, bank details, or helpline phone inside
              Subscription Plans yet. Please contact the platform onboarding desk directly.
            </p>
          </div>
        )}

        {/* Instant Receipt Confirmation Card after UTR Submission */}
        {submittedReceipt && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    Payment Reference Submitted Successfully!
                  </p>
                  <p className="mt-0.5 text-emerald-800">
                    Receipt No:{' '}
                    <strong className="font-mono">{submittedReceipt.receiptNumber}</strong> · Amount:{' '}
                    <strong>{formatINR(submittedReceipt.amount)}</strong> · UTR:{' '}
                    <strong className="font-mono">{submittedReceipt.referenceCode}</strong>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                  <Upload className="h-3.5 w-3.5" />
                  <span>
                    {uploadingProof
                      ? 'Uploading...'
                      : submittedReceipt.paymentProofDataUrl
                        ? 'Change Payment Proof'
                        : 'Upload Payment Proof'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    disabled={uploadingProof}
                    onChange={(e) => void handleAttachProofAfterSubmit(e)}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => exportPaymentReceiptPdf(submittedReceipt, organization, contact)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Receipt PDF</span>
                </button>
              </div>
            </div>

            {isSafeImageDataUrl(submittedReceipt.paymentProofDataUrl) && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-2.5">
                <img
                  src={submittedReceipt.paymentProofDataUrl}
                  alt="Uploaded payment proof"
                  className="h-14 w-14 rounded object-cover border border-slate-200"
                />
                <div className="text-xs text-emerald-900">
                  <p className="font-semibold">Payment Proof Attached</p>
                  <p className="text-[11px] text-slate-500">
                    Shared with Super Admin for payment reconciliation.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inline UTR / Payment Confirmation Form */}
        {canSubmitReference && showSubmitForm && organization && !submittedReceipt && (
          <form
            onSubmit={(e) => void handleInlineSubmit(e)}
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Submit Completed Payment Details &amp; Get Receipt
              </h3>
              <button
                type="button"
                onClick={() => setShowSubmitForm(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Hide
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Plan *</label>
                <select
                  required
                  value={planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Billing Cycle
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => handleCycleChange(e.target.value as BillingCycle)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half-Yearly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Amount Paid (₹) *
                </label>
                <div className="relative mt-1">
                  <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    min={0}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-2.5 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  UTR / Transaction / Invoice Reference *
                </label>
                <input
                  type="text"
                  required
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. 429812345678 / UPI Ref"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid via PhonePe / HDFC Net Banking"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700">
                Upload Payment Proof (Screenshot / Receipt Photo)
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3">
                {isSafeImageDataUrl(paymentProofDataUrl) ? (
                  <img
                    src={paymentProofDataUrl}
                    alt="Payment proof preview"
                    className="h-16 w-16 rounded-md border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{paymentProofDataUrl ? 'Change Screenshot' : 'Upload Payment Proof'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) => void handleProofFileSelect(e)}
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

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>{submitting ? 'Generating Receipt...' : 'Submit Payment & Get Receipt'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {canSubmitReference ? (
            !showSubmitForm && !submittedReceipt ? (
              <div className="flex flex-wrap items-center gap-3">
                {organization && userProfile ? (
                  <button
                    type="button"
                    onClick={() => setShowSubmitForm(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>I Have Paid — Submit UTR &amp; Download Receipt</span>
                  </button>
                ) : onNavigateSubmitReference ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateSubmitReference();
                    }}
                    className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                  >
                    Already paid? Submit UTR / Reference Number →
                  </button>
                ) : null}

                {!onNavigateSubmitReference && (
                  <Link
                    to="/organization-admin/subscription"
                    onClick={onClose}
                    className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                  >
                    View Past Receipts &amp; Subscription →
                  </Link>
                )}
              </div>
            ) : (
              <Link
                to="/organization-admin/subscription"
                onClick={onClose}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline"
              >
                Open Subscription &amp; Receipt History →
              </Link>
            )
          ) : (
            <span className="text-[11px] text-slate-500">
              Ask your Company / Society Admin to complete renewal payment &amp; submit UTR.
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
