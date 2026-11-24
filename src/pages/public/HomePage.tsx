import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FileText,
  Layers,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { listPublicSubscriptionPlans } from '../../services/subscriptions/subscriptionService';
import { BillingCycle, SubscriptionPlan } from '../../types';
import { DEMO_TESTIMONIALS, SAMPLE_SUBSCRIPTION_PLANS } from '../../utils/demoData';

const BILLING_LABELS: Record<BillingCycle, { label: string; suffix: string }> = {
  monthly: { label: 'Monthly', suffix: '/month' },
  quarterly: { label: 'Quarterly', suffix: '/quarter' },
  half_yearly: { label: 'Half-Yearly', suffix: '/6 months' },
  yearly: { label: 'Yearly', suffix: '/year' },
};

const FAQS = [
  {
    q: 'How does REXON isolate data between different companies, factories, and societies?',
    a: 'Every tenant organization receives a strict organizationId boundary enforced at both the query layer and Firestore Security Rules. Staff and administrators belonging to one organization cannot query, read, or mutate records belonging to another tenant.',
  },
  {
    q: 'Can users select their own role on the login page?',
    a: 'No. REXON uses a single unified login portal powered by Firebase Authentication. Upon sign-in, the platform resolves the user role and permissions strictly from a trusted Firestore user record provisioned by an authorized administrator.',
  },
  {
    q: 'How are Super Admin Staff and Organization Staff permissions configured?',
    a: 'Super Admin controls granular global permissions for Super Admin Staff, while each Organization Admin defines custom roles and module permissions for their own internal workforce across departments such as HR, Security, Accounts, and Maintenance.',
  },
  {
    q: 'How do subscription plans and activations work?',
    a: 'Only the platform Super Admin can create, modify, or retire subscription plans. Organization subscriptions are verified and activated through controlled administrative verification rather than unverified client-side callbacks.',
  },
];

export function HomePage() {
  const [previewTab, setPreviewTab] = useState<'super' | 'society' | 'factory'>('super');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>(SAMPLE_SUBSCRIPTION_PLANS);
  const [usingLivePlans, setUsingLivePlans] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    let active = true;
    listPublicSubscriptionPlans()
      .then((live) => {
        if (active && live.length > 0) {
          setPlans(live);
          setUsingLivePlans(true);
        }
      })
      .catch(() => {
        // Fallback silently to clearly labeled sample plans for unauthenticated visitors if rules/offline
      });
    return () => {
      active = false;
    };
  }, []);

  const getPrice = (plan: SubscriptionPlan) => {
    if (billingCycle === 'monthly') return plan.monthlyPrice;
    if (billingCycle === 'quarterly') return plan.quarterlyPrice;
    if (billingCycle === 'half_yearly') return plan.halfYearlyPrice;
    return plan.yearlyPrice;
  };

  return (
    <PublicLayout>
      {/* 1. HERO SECTION */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
                Multi-Tenant Security & Facility Operations Platform
              </p>
              <h1
                className="mt-3 font-display font-bold tracking-tight text-slate-900 text-balance"
                style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)', lineHeight: 1.08 }}
              >
                Smart Security & Facility Management, All in One Platform
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Manage security operations, visitors, vehicles, workforce, residential communities
                and industrial facilities through one intelligent management platform.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/features"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Features
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-6 text-xs text-slate-500">
                <span>Role-Verified Firebase Auth</span>
                <span aria-hidden="true">·</span>
                <span>Strict Tenant Isolation</span>
                <span aria-hidden="true">·</span>
                <span>Audit-Ready PDF Reporting</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[340px] overflow-hidden rounded-xl border border-slate-200 bg-[#0B192C]">
                <img
                  src="/src/assets/images/hero_rexon_command_1795519586691.jpg"
                  alt="REXON enterprise security and facility operations command center"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/85 via-[#0B192C]/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <p className="text-xs font-medium text-blue-200">
                    Unified Operations Architecture
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    Built for Security Agencies, Residential Societies, Factories & Corporate Parks
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Dashboard Preview Illustration */}
          <div className="mt-14 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Interactive Platform Workspace Preview
                </h2>
                <p className="text-xs text-slate-500">
                  Visual demonstration of role-scoped dashboards (sample preview figures)
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('super')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    previewTab === 'super'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Super Admin View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('society')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    previewTab === 'society'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Society Admin View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('factory')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    previewTab === 'factory'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Industrial Site View
                </button>
              </div>
            </div>

            {previewTab === 'super' && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Managed Organizations (Sample)</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    48
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">42 Active · 6 Pending/Expired</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Global Staff Accounts (Sample)</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    1,240
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Across 6 organization types</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Subscription Tiers</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    3
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Monthly to Yearly cycles</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Tenant Isolation</p>
                  <p className="mt-1 font-display text-2xl font-bold text-[#1D4ED8]">Enforced</p>
                  <p className="mt-1 text-xs text-slate-600">Firestore Security Rules v2</p>
                </div>
              </div>
            )}

            {previewTab === 'society' && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Registered Towers (Sample)</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    6
                  </p>
                  <p className="mt-1 text-xs text-slate-600">12 Wings mapped</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Flats & Units (Sample)</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    480
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">Owner & Tenant directories</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Society Workforce (Sample)</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    34
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Security, Maintenance, Admin</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">PDF Directories</p>
                  <p className="mt-1 font-display text-2xl font-bold text-[#1D4ED8]">Ready</p>
                  <p className="mt-1 text-xs text-slate-600">Tower, Wing & Flat exports</p>
                </div>
              </div>
            )}

            {previewTab === 'factory' && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Plant Departments (Sample)</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    8
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Security, HR, Logistics, Ops</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Custom Role Templates</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    100%
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Configurable per plant admin</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Gate & Goods Roadmap</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900">Phase 2+</p>
                  <p className="mt-1 text-xs text-slate-600">Vehicles & Inward/Outward</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Audit Trail</p>
                  <p className="mt-1 font-display text-2xl font-bold text-[#1D4ED8]">Append-Only</p>
                  <p className="mt-1 text-xs text-slate-600">Immutable change logging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. OUR PLATFORM & WHY CHOOSE REXON */}
      <section className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">Our Platform</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Engineered for Multi-Tenant Governance Without Compromising Isolation
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Organizations managing physical premises require clean separation between global
                platform oversight and site-level operations. REXON enforces strict tenant
                boundaries from database rules through to every dashboard route.
              </p>
              <div className="mt-6">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                >
                  <span>Read about our architecture and mission</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <Lock className="h-5 w-5 text-[#1D4ED8]" />
                <h3 className="mt-4 font-display text-base font-bold text-slate-900">
                  Zero-Trust Multi-Tenancy
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Every tenant record carries a verified organizationId verified in Firestore rules,
                  blocking cross-organization queries at the database boundary.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" />
                <h3 className="mt-4 font-display text-base font-bold text-slate-900">
                  Trusted Role Resolution
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Roles are assigned exclusively by authorized administrators and stored in trusted
                  Firestore profiles—never chosen by users during login.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <Users className="h-5 w-5 text-[#1D4ED8]" />
                <h3 className="mt-4 font-display text-base font-bold text-slate-900">
                  Granular Staff Permissions
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Both Super Admin Staff and Organization Staff receive per-module permission flags
                  tailored to their department and operational responsibility.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <FileText className="h-5 w-5 text-[#1D4ED8]" />
                <h3 className="mt-4 font-display text-base font-bold text-slate-900">
                  Audit & PDF Readiness
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Every sensitive change writes to append-only audit logs, while authorized staff
                  can generate clean PDF directories and operational reports.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INDUSTRIES WE SERVE */}
      <section className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
              Industries We Serve
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              One Core Platform Across Diverse Premises
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Configured to accommodate residential towers, industrial gates, corporate offices,
              and contract security agencies.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <img
                  src="/src/assets/images/industry_residential_society_1795519586062.jpg"
                  alt="Residential societies and gated apartment towers"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Residential Societies & Apartments
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Manage towers, wings, flats, owner/tenant occupancy directories, and society staff
                  permissions with clean resident-facing accountability.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <img
                  src="/src/assets/images/industry_industrial_factory_1795519586462.jpg"
                  alt="Factories and industrial logistics facilities"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Factories & Industrial Plants
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Organize plant administration, gate security teams, shift departments, and future
                  vehicle and goods inward/outward workflows.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <img
                  src="/src/assets/images/industry_corporate_office_1795519586220.jpg"
                  alt="Corporate offices and commercial towers"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Corporate Offices & Security Agencies
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Standardize reception, facility maintenance, and security supervision across single
                  campuses or multi-client agency deployments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. KEY FEATURES & HOW IT WORKS */}
      <section className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">How It Works</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
                Structured Onboarding From Platform Root to Individual Unit
              </h2>
              <div className="mt-8 space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    01. Super Admin Provisions Tenant Organization
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Super Admin registers the company, factory, or society, assigns its verified
                    subscription plan, and pre-authorizes the Organization Admin login.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    02. Organization Admin Configures Staff & Property Structure
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Inside their isolated workspace, the Organization Admin creates departments,
                    custom role templates, towers, wings, and flat occupancy records.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    03. Permission-Scoped Staff Operate & Export Reports
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Staff members sign in through the unified login portal and access only their
                    permitted modules, with PDF exports and audit logs active from day one.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">Key Capabilities</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
                Built for Phase 1 Readiness & Multi-Phase Scale
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Building2,
                    title: 'Multi-Tenant Orgs',
                    desc: 'Support Companies, Factories, Societies, Apartments, and Industries.',
                  },
                  {
                    icon: Layers,
                    title: 'Tower, Wing & Flat Hierarchy',
                    desc: 'Relational property mapping with owner and tenant occupancy records.',
                  },
                  {
                    icon: Users,
                    title: 'Departmental RBAC',
                    desc: 'Flexible permissions across Security, HR, Accounts, Operations, and Reception.',
                  },
                  {
                    icon: FileText,
                    title: 'jsPDF Operational Reports',
                    desc: 'Export organization-wise, staff, tower, wing, and flat directories.',
                  },
                ].map((feat) => (
                  <div
                    key={feat.title}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <feat.icon className="h-5 w-5 text-[#1D4ED8]" />
                    <h3 className="mt-3 font-display text-base font-bold text-slate-900">
                      {feat.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600">{feat.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link
                  to="/services"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                >
                  <span>Explore all 9 platform service categories</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SUBSCRIPTION PLANS PREVIEW */}
      <section className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
                {usingLivePlans
                  ? 'Live Published Plans'
                  : 'Sample Subscription Plans (Preview)'}
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
                Transparent Licensing for Every Organization Size
              </h2>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
              {(Object.keys(BILLING_LABELS) as BillingCycle[]).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    billingCycle === cycle
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {BILLING_LABELS[cycle].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.slice(0, 3).map((plan, idx) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-xl border p-6 ${
                  idx === 1
                    ? 'border-[#1D4ED8] bg-slate-50/60'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <p className="text-xs font-medium text-slate-500">
                  {plan.targetAudience || 'Enterprise Deployment'}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{plan.description}</p>

                <div className="mt-6 flex items-baseline gap-1 border-b border-slate-200 pb-6">
                  <span className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                    ${getPrice(plan)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {BILLING_LABELS[billingCycle].suffix}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs font-medium text-slate-700 tabular-nums">
                  <span>Max Staff: {plan.maxStaff}</span>
                  <span aria-hidden="true">·</span>
                  <span>Max Sites: {plan.maxSites}</span>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
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
                  Request Organization Onboarding
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-6 text-right">
            <Link
              to="/plans"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
            >
              <span>View full plan comparison</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. TESTIMONIALS (EXPLICITLY MARKED AS DEMO CONTENT) */}
      <section className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-amber-700">
              Demo Preview Content — Illustrative Scenarios Only
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              How Organizations Standardize Operations
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Note: The scenarios below are clearly labeled demo placeholders until verified client
              testimonials are published.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {DEMO_TESTIMONIALS.map((item) => (
              <div
                key={item.author}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
              >
                <div>
                  <p className="text-xs font-semibold text-[#1D4ED8]">{item.metric}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">“{item.quote}”</p>
                </div>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-sm font-bold text-slate-900">{item.author}</p>
                  <p className="text-xs text-slate-500">
                    {item.role} · {item.organization}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
              Frequently Asked Questions
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Security, Multi-Tenancy & Access Architecture
            </h2>
          </div>

          <div className="mt-10 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className="p-5 sm:p-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="font-display text-base font-semibold text-slate-900">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. CONTACT CTA */}
      <section className="bg-[#0B192C] py-16 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Ready to Provision Your Organization Workspace?
            </h2>
            <p className="mt-3 text-base text-slate-300">
              Connect with our onboarding desk to configure your tenant account, staff roles, and
              facility hierarchy on REXON MANAGEMENT APP.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              to="/contact"
              className="rounded-lg bg-[#1D4ED8] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              Request Onboarding
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-slate-600 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Portal Login
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
