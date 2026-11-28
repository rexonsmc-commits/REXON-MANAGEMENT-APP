import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Info } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { listPublicSubscriptionPlans } from '../../services/subscriptions/subscriptionService';
import { BillingCycle, SubscriptionPlan } from '../../types';
import { SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';
import { formatINR } from '../../utils/subscriptionHelpers';

const CYCLES: { key: BillingCycle; label: string; suffix: string }[] = [
  { key: 'monthly', label: 'Monthly', suffix: '/month' },
  { key: 'quarterly', label: 'Quarterly', suffix: '/quarter' },
  { key: 'half_yearly', label: 'Half-Yearly', suffix: '/6 months' },
  { key: 'yearly', label: 'Yearly', suffix: '/year' },
];

export function PlansPage() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    listPublicSubscriptionPlans()
      .then((live) => {
        if (mounted && live.length > 0) {
          setPlans(live);
          setIsLive(true);
        }
      })
      .catch(() => {
        // Keep clearly labeled sample plans
      });
    return () => {
      mounted = false;
    };
  }, []);

  const priceFor = (plan: SubscriptionPlan) => {
    switch (cycle) {
      case 'monthly':
        return plan.monthlyPrice;
      case 'quarterly':
        return plan.quarterlyPrice;
      case 'half_yearly':
        return plan.halfYearlyPrice;
      case 'yearly':
        return plan.yearlyPrice;
    }
  };

  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
                {isLive
                  ? 'Live Subscription Plans (Super Admin Managed)'
                  : 'Sample Subscription Plans (Demo Preview)'}
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900">
                Flexible Multi-Cycle Plans Controlled by Platform Governance
              </h1>
              <p className="mt-4 text-base text-slate-600">
                Compare Monthly, Quarterly, Half-Yearly, and Yearly billing cycles. Plan activation
                is verified securely by the platform Super Admin upon onboarding.
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
              {CYCLES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCycle(c.key)}
                  className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    cycle === c.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {!isLive && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>
                Displaying <strong>Sample Plans</strong> for initial preview. Live plans published by
                Super Admin in Firestore automatically replace these sample tiers. No simulated
                checkout or fake payment processing is enabled.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, idx) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-xl border p-6 ${
                  idx === 1 ? 'border-[#1D4ED8] bg-white shadow-sm' : 'border-slate-200 bg-white'
                }`}
              >
                <p className="text-xs font-medium text-slate-500">
                  {plan.targetAudience || 'Organization Plan'}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">{plan.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{plan.description}</p>

                <div className="mt-6 border-b border-slate-200 pb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-slate-900 tabular-nums">
                      {formatINR(priceFor(plan))}
                    </span>
                    <span className="text-sm text-slate-500">
                      {CYCLES.find((c) => c.key === cycle)?.suffix}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 tabular-nums">
                    Up to {plan.maxStaff} staff · Up to {plan.maxSites} sites
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={`/contact?plan=${encodeURIComponent(plan.name)}`}
                  className={`mt-8 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    idx === 1
                      ? 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                      : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Request Activation & Onboarding
                </Link>
              </div>
            ))}
          </div>

          {/* Comparison Matrix */}
          <div className="mt-14 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Plan Limits & Billing Comparison
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3 text-right">Monthly</th>
                    <th className="px-6 py-3 text-right">Quarterly</th>
                    <th className="px-6 py-3 text-right">Half-Yearly</th>
                    <th className="px-6 py-3 text-right">Yearly</th>
                    <th className="px-6 py-3 text-right">Max Staff</th>
                    <th className="px-6 py-3 text-right">Max Sites</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-3.5 font-semibold text-slate-900">{p.name}</td>
                      <td className="px-6 py-3.5 text-right text-slate-700">{formatINR(p.monthlyPrice)}</td>
                      <td className="px-6 py-3.5 text-right text-slate-700">{formatINR(p.quarterlyPrice)}</td>
                      <td className="px-6 py-3.5 text-right text-slate-700">
                        {formatINR(p.halfYearlyPrice)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                        {formatINR(p.yearlyPrice)}
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-700">{p.maxStaff}</td>
                      <td className="px-6 py-3.5 text-right text-slate-700">{p.maxSites}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
