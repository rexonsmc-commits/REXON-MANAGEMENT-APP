import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  Check,
  CreditCard,
  Download,
  Edit2,
  Landmark,
  PhoneCall,
  Plus,
  QrCode,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { PdfExportModal, PdfFilterValues } from '../../components/common/PdfExportModal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { exportTableToPdf } from '../../services/reports/pdfService';
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getBillingContactConfig,
  listAllSubscriptionPlans,
  saveBillingContactConfig,
  updateSubscriptionPlan,
} from '../../services/subscriptions/subscriptionService';
import { SubscriptionPlan } from '../../types';
import { SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';
import { compressImageFileToDataUrl } from '../../utils/imageHelpers';
import {
  formatCurrencyForPdf,
  formatDisplayDate,
  formatINR,
  matchesDateFilter,
} from '../../utils/subscriptionHelpers';

export function SubscriptionPlansPage() {
  const { userProfile, firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'plans' | 'direct_payment'>('plans');

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('1499');
  const [quarterlyPrice, setQuarterlyPrice] = useState('3999');
  const [halfYearlyPrice, setHalfYearlyPrice] = useState('7499');
  const [yearlyPrice, setYearlyPrice] = useState('13999');
  const [maxStaff, setMaxStaff] = useState('25');
  const [maxSites, setMaxSites] = useState('1');
  const [featuresText, setFeaturesText] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Direct Payment, Support Helpline, UPI QR & Net Banking Configuration
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiNumber, setUpiNumber] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Online checkout is disabled. Pay directly via UPI QR (PhonePe / Paytm / GPay), UPI ID, Net Banking (NEFT/RTGS/IMPS), or call our billing helpline, then submit your UTR reference to download your payment receipt immediately.'
  );
  const [upiOrBankNote, setUpiOrBankNote] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const loadPlansAndPaymentConfig = useCallback(async () => {
    if (!userProfile || !firebaseUser) return;
    setLoading(true);
    try {
      const [data, billingData] = await Promise.all([
        listAllSubscriptionPlans(),
        getBillingContactConfig().catch(() => null),
      ]);
      setPlans(data);
      if (billingData) {
        setSupportPhone(billingData.supportPhone || '');
        setSupportEmail(billingData.supportEmail || '');
        setContactPersonName(billingData.contactPersonName || '');
        setUpiId(billingData.upiId || '');
        setUpiNumber(billingData.upiNumber || '');
        setUpiPayeeName(billingData.upiPayeeName || '');
        setQrCodeDataUrl(billingData.qrCodeDataUrl || '');
        setBankName(billingData.bankName || '');
        setAccountHolderName(billingData.accountHolderName || '');
        setAccountNumber(billingData.accountNumber || '');
        setIfscCode(billingData.ifscCode || '');
        setBankBranch(billingData.bankBranch || '');
        if (billingData.paymentInstructions) {
          setPaymentInstructions(billingData.paymentInstructions);
        }
        setUpiOrBankNote(billingData.upiOrBankNote || '');
      }
    } catch (err) {
      showToast('Failed to load plans', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [showToast, userProfile, firebaseUser]);

  useEffect(() => {
    if (!userProfile || !firebaseUser) return;
    void loadPlansAndPaymentConfig();
  }, [loadPlansAndPaymentConfig, userProfile, firebaseUser]);

  const handleQrFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxDim: 480, maxChars: 350000 });
      setQrCodeDataUrl(dataUrl);
      showToast('UPI QR code ready', 'success', 'Click Save Payment & Support Settings to publish.');
    } catch (err) {
      showToast(
        'Could not process QR image',
        'error',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleSaveBillingContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isSuperAdmin) return;
    setSavingContact(true);
    try {
      await saveBillingContactConfig(
        {
          supportPhone,
          supportEmail,
          contactPersonName,
          upiId,
          upiNumber,
          upiPayeeName,
          qrCodeDataUrl,
          bankName,
          accountHolderName,
          accountNumber,
          ifscCode,
          bankBranch,
          paymentInstructions,
          upiOrBankNote,
        },
        userProfile
      );
      showToast(
        'Direct payment & UPI QR settings saved',
        'success',
        'Companies & Societies will see these payment options when clicking Pay Now / Renew.'
      );
    } catch (err) {
      showToast('Failed to save payment settings', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingContact(false);
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setName('');
    setDescription('');
    setTargetAudience('');
    setMonthlyPrice('1499');
    setQuarterlyPrice('3999');
    setHalfYearlyPrice('7499');
    setYearlyPrice('13999');
    setMaxStaff('25');
    setMaxSites('1');
    setFeaturesText('Multi-tenant isolation\nRole-based staff access\nPDF directory exports');
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description);
    setTargetAudience(plan.targetAudience || '');
    setMonthlyPrice(String(plan.monthlyPrice));
    setQuarterlyPrice(String(plan.quarterlyPrice));
    setHalfYearlyPrice(String(plan.halfYearlyPrice));
    setYearlyPrice(String(plan.yearlyPrice));
    setMaxStaff(String(plan.maxStaff));
    setMaxSites(String(plan.maxSites));
    setFeaturesText(plan.features.join('\n'));
    setStatus(plan.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const features = featuresText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = {
        name,
        description,
        targetAudience,
        monthlyPrice: Number(monthlyPrice) || 0,
        quarterlyPrice: Number(quarterlyPrice) || 0,
        halfYearlyPrice: Number(halfYearlyPrice) || 0,
        yearlyPrice: Number(yearlyPrice) || 0,
        maxStaff: Math.max(1, Number(maxStaff) || 1),
        maxSites: Math.max(1, Number(maxSites) || 1),
        features: features.length > 0 ? features : ['Core platform access'],
        status,
      };
      if (editingPlan) {
        await updateSubscriptionPlan(editingPlan.id, payload, userProfile);
        showToast('Subscription plan updated', 'success', name);
      } else {
        await createSubscriptionPlan(payload, userProfile);
        showToast('Subscription plan published', 'success', name);
      }
      setModalOpen(false);
      await loadPlansAndPaymentConfig();
    } catch (err) {
      showToast('Save failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedSamplePlans = async () => {
    if (!userProfile) return;
    setSaving(true);
    try {
      for (const p of SAMPLE_SUBSCRIPTION_PLANS) {
        await createSubscriptionPlan(
          {
            name: p.name,
            description: p.description,
            targetAudience: p.targetAudience,
            monthlyPrice: p.monthlyPrice,
            quarterlyPrice: p.quarterlyPrice,
            halfYearlyPrice: p.halfYearlyPrice,
            yearlyPrice: p.yearlyPrice,
            features: p.features,
            maxStaff: p.maxStaff,
            maxSites: p.maxSites,
            status: 'active',
          },
          userProfile
        );
      }
      showToast('Sample plans published to Firestore', 'success');
      await loadPlansAndPaymentConfig();
    } catch (err) {
      showToast('Failed to publish sample plans', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !userProfile) return;
    setSaving(true);
    try {
      await deleteSubscriptionPlan(deleteTarget.id, deleteTarget.name, userProfile);
      showToast('Plan deleted', 'success', deleteTarget.name);
      setDeleteTarget(null);
      await loadPlansAndPaymentConfig();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const filterPlansForPdf = (filters: PdfFilterValues) => {
    const source = plans.length > 0 ? plans : SAMPLE_SUBSCRIPTION_PLANS;
    return source.filter((plan) => {
      const dateVal = plan.updatedAt || plan.createdAt;
      if (filters.dateFilter.mode !== 'all' && !matchesDateFilter(dateVal, filters.dateFilter)) {
        return false;
      }
      if (filters.extraFilter !== 'all' && plan.status !== filters.extraFilter) {
        return false;
      }
      return true;
    });
  };

  const handleExportPdf = (filters: PdfFilterValues, filterSummary: string) => {
    const rowsData = filterPlansForPdf(filters);
    exportTableToPdf({
      title: 'Subscription Plans Catalog (INR)',
      subtitle: `${plans.length > 0 ? 'Source: Live Firestore' : 'Source: Sample Plans'}  |  ${filterSummary}`,
      generatedBy: userProfile?.email || 'Super Admin',
      columns: [
        'Plan Name',
        'Monthly',
        'Quarterly',
        'Half-Yearly',
        'Yearly',
        'Limits',
        'Status',
        'Updated',
      ],
      rows: rowsData.map((p) => [
        p.name,
        formatCurrencyForPdf(p.monthlyPrice, 'INR'),
        formatCurrencyForPdf(p.quarterlyPrice, 'INR'),
        formatCurrencyForPdf(p.halfYearlyPrice, 'INR'),
        formatCurrencyForPdf(p.yearlyPrice, 'INR'),
        `${p.maxStaff} Staff / ${p.maxSites} Sites`,
        p.status,
        formatDisplayDate(p.updatedAt || p.createdAt),
      ]),
      filename: 'rexon-subscription-plans-inr',
    });
  };

  return (
    <DashboardLayout
      title="Subscription Plans & Direct Payment Setup"
      subtitle="Manage Monthly, Quarterly, Half-Yearly, and Yearly tiers in Indian Rupees (₹), plus UPI QR, PhonePe/Paytm, Net Banking, and billing support."
      actions={
        activeTab === 'plans' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
            {plans.length === 0 && !loading && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSeedSamplePlans()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4 text-[#1D4ED8]" />
                <span>Publish Starter Plans</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Create Plan</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Top Section Switcher Buttons */}
        <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'plans'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Subscription Plans</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                activeTab === 'plans'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {plans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct_payment')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'direct_payment'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Direct Payment, UPI QR &amp; Renewal Support</span>
          </button>
        </div>

        {activeTab === 'plans' &&
          (loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <h2 className="font-display text-lg font-bold text-slate-900">
              No Live Subscription Plans Configured
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              The public website currently falls back to Sample Plans. Create your official pricing
              plans or publish the 3 starter tiers to Firestore.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void handleSeedSamplePlans()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Publish 3 Starter Plans
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
              >
                Create Custom Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900">{plan.name}</h2>
                      <p className="text-xs text-slate-500">{plan.targetAudience}</p>
                    </div>
                    <StatusLabel status={plan.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{plan.description}</p>

                  <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs tabular-nums">
                    <div>
                      <span className="text-slate-500">Monthly:</span>{' '}
                      <strong className="text-slate-900">{formatINR(plan.monthlyPrice)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Quarterly:</span>{' '}
                      <strong className="text-slate-900">{formatINR(plan.quarterlyPrice)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Half-Yearly:</span>{' '}
                      <strong className="text-slate-900">{formatINR(plan.halfYearlyPrice)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Yearly:</span>{' '}
                      <strong className="text-slate-900">{formatINR(plan.yearlyPrice)}</strong>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs font-medium text-slate-700 tabular-nums">
                    <span>Max Staff: {plan.maxStaff}</span>
                    <span>·</span>
                    <span>Max Sites: {plan.maxSites}</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-xs text-slate-700">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => openEdit(plan)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(plan)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Direct Payment, Support Helpline, UPI QR & Net Banking Setup */}
        {activeTab === 'direct_payment' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-[#1D4ED8]" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Direct Payment, UPI QR &amp; Renewal Support Contact (INR / ₹)
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Shown directly to Companies &amp; Societies when they click &ldquo;Pay Now / Renew&rdquo;
                in their subscription panel. Upload your PhonePe / Paytm / UPI QR scanner, UPI ID/Number,
                and Net Banking details so tenants can pay instantly and download their PDF receipt.
              </p>
            </div>
            {!isSuperAdmin && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Read-only (Super Admin edits only)
              </span>
            )}
          </div>

          <form onSubmit={(e) => void handleSaveBillingContact(e)} className="mt-5 space-y-6">
            {/* 1. Support Helpline */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Renewal Support Contact
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Support Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperAdmin}
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Contact Person / Billing Desk
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                    placeholder="e.g. REXON Billing Desk"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Support Email
                  </label>
                  <input
                    type="email"
                    disabled={!isSuperAdmin}
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 2. UPI ID, Mobile Number & QR Scanner Upload */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. UPI / PhonePe / Paytm / GPay Scanner Setup
                </h3>
              </div>

              <div className="mt-3 grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        UPI ID (VPA)
                      </label>
                      <input
                        type="text"
                        disabled={!isSuperAdmin}
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="e.g. rexon@ybl or business@okaxis"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        UPI Mobile Number (PhonePe / Paytm / GPay)
                      </label>
                      <input
                        type="text"
                        disabled={!isSuperAdmin}
                        value={upiNumber}
                        onChange={(e) => setUpiNumber(e.target.value)}
                        placeholder="+91 98XXX XXXXX"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Payee / Registered Business Name on UPI
                    </label>
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={upiPayeeName}
                      onChange={(e) => setUpiPayeeName(e.target.value)}
                      placeholder="e.g. REXON MANAGEMENT SERVICES"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* QR Scanner Image Upload Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <QrCode className="h-4 w-4 text-[#1D4ED8]" />
                      <span>Payment QR Code Image</span>
                    </span>
                    {qrCodeDataUrl && isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setQrCodeDataUrl('')}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Remove QR
                      </button>
                    )}
                  </div>

                  {qrCodeDataUrl ? (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                        <img
                          src={qrCodeDataUrl}
                          alt="Uploaded UPI Payment QR"
                          className="h-36 w-36 object-contain"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Scan with PhonePe / Paytm / GPay / BHIM
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-3 text-center">
                      <QrCode className="h-7 w-7 text-slate-300" />
                      <p className="mt-1.5 text-xs text-slate-500">No QR code uploaded yet</p>
                    </div>
                  )}

                  {isSuperAdmin && (
                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{qrCodeDataUrl ? 'Change QR Image' : 'Upload QR Image'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => void handleQrFileChange(e)}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Net Banking / Bank Transfer Details */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3. Net Banking / NEFT / RTGS / IMPS Bank Details
                </h3>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Bank Name</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="e.g. Rexon Technologies"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Number
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 50200012345678"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">IFSC Code</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0000123"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Branch Name</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="e.g. Sector 18, Noida"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 4. Instructions */}
            <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Direct Payment Message / Instructions *
                </label>
                <textarea
                  rows={3}
                  required
                  disabled={!isSuperAdmin}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Optional UPI / Bank Transfer Note
                </label>
                <textarea
                  rows={3}
                  disabled={!isSuperAdmin}
                  value={upiOrBankNote}
                  onChange={(e) => setUpiOrBankNote(e.target.value)}
                  placeholder="e.g. Share UTR after PhonePe/Paytm/NEFT payment for instant verification."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-100"
                />
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={savingContact}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingContact ? 'Saving...' : 'Save Payment & Support Settings'}</span>
                </button>
              </div>
            )}
          </form>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
        maxWidth="xl"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Plan Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., For growing factories & societies"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Description *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Monthly (₹)</label>
              <input
                type="number"
                min={0}
                required
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Quarterly (₹)</label>
              <input
                type="number"
                min={0}
                required
                value={quarterlyPrice}
                onChange={(e) => setQuarterlyPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Half-Yearly (₹)</label>
              <input
                type="number"
                min={0}
                required
                value={halfYearlyPrice}
                onChange={(e) => setHalfYearlyPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Yearly (₹)</label>
              <input
                type="number"
                min={0}
                required
                value={yearlyPrice}
                onChange={(e) => setYearlyPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Max Staff</label>
              <input
                type="number"
                min={1}
                required
                value={maxStaff}
                onChange={(e) => setMaxStaff(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Max Sites</label>
              <input
                type="number"
                min={1}
                required
                value={maxSites}
                onChange={(e) => setMaxSites(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Plan Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="active">Active (Visible Publicly)</option>
                <option value="inactive">Inactive (Hidden)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Plan Features (one per line)
            </label>
            <textarea
              rows={4}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
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
              {saving ? 'Saving...' : editingPlan ? 'Save Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Export Subscription Plans PDF"
        extraFilterLabel="Plan Status"
        extraFilterOptions={[
          { label: 'All Statuses', value: 'all' },
          { label: 'Active Plans', value: 'active' },
          { label: 'Inactive Plans', value: 'inactive' },
        ]}
        getMatchCount={(f) => filterPlansForPdf(f).length}
        onExport={handleExportPdf}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Subscription Plan"
        message={`Delete subscription plan "${deleteTarget?.name}"?`}
        confirmLabel="Delete Plan"
      />
    </DashboardLayout>
  );
}
