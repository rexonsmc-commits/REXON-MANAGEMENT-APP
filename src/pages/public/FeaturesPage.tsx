import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CreditCard,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Lock,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';

type FeatureCategory = 'all' | 'governance' | 'property' | 'security' | 'reporting';

const FEATURES = [
  {
    category: 'governance',
    icon: Lock,
    title: 'Zero-Trust Multi-Tenant Isolation',
    status: 'Phase 1 Operational',
    description:
      'Every tenant organization operates inside an isolated data boundary enforced by Firestore Security Rules and validated organizationId scopes.',
  },
  {
    category: 'governance',
    icon: KeyRound,
    title: 'Unified Login & Trusted Role Resolution',
    status: 'Phase 1 Operational',
    description:
      'One unified portal for Super Admin, Super Admin Staff, Organization Admins, and Staff—automatically routed via verified Firestore user records.',
  },
  {
    category: 'governance',
    icon: CreditCard,
    title: 'Super Admin Subscription Governance',
    status: 'Phase 1 Operational',
    description:
      'Centralized creation of Monthly, Quarterly, Half-Yearly, and Yearly tiers with payment verification gates before tenant activation.',
  },
  {
    category: 'property',
    icon: Layers,
    title: 'Tower, Wing & Flat Hierarchy',
    status: 'Phase 1 Operational',
    description:
      'Structured relational mapping of residential towers, assigned wings, flat types, and owner/tenant occupancy status.',
  },
  {
    category: 'security',
    icon: Users,
    title: 'Granular Department & Role Matrix',
    status: 'Phase 1 Operational',
    description:
      'Assign custom permissions per staff member across Security, HR, Accounts, Reception, Maintenance, and Operations.',
  },
  {
    category: 'security',
    icon: ShieldAlert,
    title: 'Gate, Guard & Visitor Roadmap',
    status: 'Planned Phase 2',
    description:
      'Upcoming operational modules for guard shift logs, gunman deployment, visitor passes, vehicle entry, and factory goods movement.',
  },
  {
    category: 'reporting',
    icon: FileSpreadsheet,
    title: 'PDF Directory & Analytics Exports',
    status: 'Phase 1 Operational',
    description:
      'Generate structured PDF reports for organizations, staff rosters, towers, wings, flats, and subscriptions with date/year filters.',
  },
  {
    category: 'governance',
    icon: Building2,
    title: 'Append-Only Audit Logging',
    status: 'Phase 1 Operational',
    description:
      'Immutable audit records capturing organization provisioning, role changes, property edits, and subscription verifications.',
  },
];

export function FeaturesPage() {
  const [filter, setFilter] = useState<FeatureCategory>('all');

  const visibleFeatures =
    filter === 'all' ? FEATURES : FEATURES.filter((f) => f.category === filter);

  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
                Platform Features
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900">
                Enterprise Architecture Designed for Real Operational Control
              </h1>
              <p className="mt-4 text-base text-slate-600">
                Filter capabilities by governance, property management, security workforce, and
                reporting foundations.
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'All Capabilities' },
                  { id: 'governance', label: 'Governance' },
                  { id: 'property', label: 'Property' },
                  { id: 'security', label: 'Security & RBAC' },
                  { id: 'reporting', label: 'Reporting' },
                ] as { id: FeatureCategory; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {visibleFeatures.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <item.icon className="h-5 w-5 text-[#1D4ED8]" />
                <span className="text-xs font-medium text-slate-500">{item.status}</span>
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Evaluate REXON for Your Organization
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Review our transparent multi-cycle subscription plans or contact our onboarding desk.
              </p>
            </div>
            <Link
              to="/plans"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              <span>View Subscription Plans</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
