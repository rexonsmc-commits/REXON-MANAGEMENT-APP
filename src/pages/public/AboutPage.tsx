import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Lock, ShieldCheck, Target } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';

export function AboutPage() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
              About REXON MANAGEMENT APP
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 text-balance">
              Building Unified Governance for Modern Security & Facility Operations
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              REXON MANAGEMENT APP is a multi-tenant SaaS foundation designed for security agencies,
              residential societies, apartments, factories, industrial complexes, and corporate
              campuses that require structured accountability across people, properties, and
              permissions.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <Compass className="h-6 w-6 text-[#1D4ED8]" />
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Our Vision</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              To become the standard digital operations backbone connecting physical site security,
              property hierarchies, and workforce governance into one transparent, reliable cloud
              platform.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <Target className="h-6 w-6 text-[#1D4ED8]" />
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Our Mission</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Eliminate fragmented registers and insecure spreadsheets by giving every organization
              an isolated, role-verified workspace with audit-ready records and configurable staff
              permissions.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <ShieldCheck className="h-6 w-6 text-[#1D4ED8]" />
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Our Goals</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Deliver zero-trust multi-tenant isolation in Phase 1 while establishing a clean,
              modular codebase ready to power visitor logs, gate operations, and goods movement in
              subsequent phases.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Why We Built This Platform
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Across residential communities, manufacturing plants, and commercial towers,
              administrators often rely on disconnected tools for staff rosters, property
              directories, and vendor oversight. When permissions are loosely managed, sensitive
              resident or employee data becomes exposed.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              REXON addresses this at the architectural layer: one unified platform where Super Admin
              oversees subscriptions and onboarding, while each Organization Admin maintains full
              autonomy over their isolated tenant workspace.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
              <Lock className="h-6 w-6 text-[#1D4ED8]" />
              <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
                Our Commitment to Security & Efficiency
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li>
                  • Strict database-level tenant isolation using verified organizationId boundaries.
                </li>
                <li>
                  • Trusted backend-verified role resolution with zero client-side role selection.
                </li>
                <li>
                  • Append-only administrative audit logs tracking critical organizational actions.
                </li>
                <li>
                  • Clean, responsive interfaces built for desktop command centers and field tablets.
                </li>
              </ul>
              <div className="mt-6">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF]"
                >
                  <span>Connect With Our Team</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
