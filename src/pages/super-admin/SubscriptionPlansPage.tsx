import { useCallback, useEffect, useState } from 'react';
import { Check, Edit2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ConfirmDialog, Modal } from '../../components/common/Modal';
import { StatusLabel } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  listAllSubscriptionPlans,
  updateSubscriptionPlan,
} from '../../services/subscriptions/subscriptionService';
import { SubscriptionPlan } from '../../types';
import { SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';

export function SubscriptionPlansPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('49');
  const [quarterlyPrice, setQuarterlyPrice] = useState('135');
  const [halfYearlyPrice, setHalfYearlyPrice] = useState('255');
  const [yearlyPrice, setYearlyPrice] = useState('470');
  const [maxStaff, setMaxStaff] = useState('25');
  const [maxSites, setMaxSites] = useState('1');
  const [featuresText, setFeaturesText] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAllSubscriptionPlans();
      setPlans(data);
    } catch (err) {
      showToast('Failed to load plans', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const openCreate = () => {
    setEditingPlan(null);
    setName('');
    setDescription('');
    setTargetAudience('');
    setMonthlyPrice('49');
    setQuarterlyPrice('135');
    setHalfYearlyPrice('255');
    setYearlyPrice('470');
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
      await loadPlans();
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
      await loadPlans();
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
      await loadPlans();
    } catch (err) {
      showToast('Delete failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Subscription Plans Governance"
      subtitle="Super Admin controls all Monthly, Quarterly, Half-Yearly, and Yearly subscription tiers published to Firestore."
      actions={
        <div className="flex items-center gap-2">
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
      }
    >
      {loading ? (
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
                    <strong className="text-slate-900">${plan.monthlyPrice}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Quarterly:</span>{' '}
                    <strong className="text-slate-900">${plan.quarterlyPrice}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Half-Yearly:</span>{' '}
                    <strong className="text-slate-900">${plan.halfYearlyPrice}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Yearly:</span>{' '}
                    <strong className="text-slate-900">${plan.yearlyPrice}</strong>
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
      )}

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
              <label className="block text-xs font-semibold text-slate-700">Monthly ($)</label>
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
              <label className="block text-xs font-semibold text-slate-700">Quarterly ($)</label>
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
              <label className="block text-xs font-semibold text-slate-700">Half-Yearly ($)</label>
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
              <label className="block text-xs font-semibold text-slate-700">Yearly ($)</label>
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
