import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building,
  Car,
  ClipboardCheck,
  Factory,
  FileBarChart,
  Package,
  Shield,
  Users,
  Wrench,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';

const SERVICE_CATEGORIES = [
  {
    icon: Shield,
    title: '01. Security Management',
    phase: 'Core Platform Category',
    description:
      'Role-scoped security workforce oversight, guard and supervisor directory foundations, and hierarchical accountability across guarded sites.',
  },
  {
    icon: ClipboardCheck,
    title: '02. Visitor Management',
    phase: 'Planned Operational Module',
    description:
      'Architecture designed for structured visitor check-in, host approval workflows, and time-stamped entry logs tied to towers and flats.',
  },
  {
    icon: Car,
    title: '03. Vehicle Entry Management',
    phase: 'Planned Operational Module',
    description:
      'Framework for resident, staff, and commercial vehicle registration, parking allocation, and gate movement verification.',
  },
  {
    icon: Factory,
    title: '04. Factory Gate Management',
    phase: 'Planned Operational Module',
    description:
      'Dedicated industrial gatehouse workflows supporting shift personnel verification, contractor passes, and multi-gate plant coordination.',
  },
  {
    icon: Package,
    title: '05. Goods Inward and Outward Management',
    phase: 'Planned Operational Module',
    description:
      'Structured material movement tracking for industrial plants and warehouses, linking gate challans with authorized sign-offs.',
  },
  {
    icon: Building,
    title: '06. Society Management',
    phase: 'Phase 1 Foundation Active',
    description:
      'Live multi-tenant management of residential towers, wings, flats, and owner/tenant occupancy status directories.',
  },
  {
    icon: Users,
    title: '07. Employee and Staff Management',
    phase: 'Phase 1 Foundation Active',
    description:
      'Live department-based staff onboarding, custom role templates, granular permission assignment, and activation controls.',
  },
  {
    icon: Wrench,
    title: '08. Facility Management',
    phase: 'Core Platform Category',
    description:
      'Centralized site profile management, maintenance team role scoping, and multi-premise structural organization.',
  },
  {
    icon: FileBarChart,
    title: '09. Reports and Analytics',
    phase: 'Phase 1 Foundation Active',
    description:
      'Live organization-wise, date-wise, and year-wise filtered reporting with downloadable PDF directory and operations exports.',
  },
];

export function ServicesPage() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
              Platform Service Categories
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 text-balance">
              Comprehensive Security & Facility Capabilities Built on a Modular Core
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Below are the nine core service domains supported by the REXON platform architecture.
              Phase 1 delivers the multi-tenant governance, RBAC, property hierarchy, and reporting
              foundations, while specialized gate and visitor modules roll out in upcoming phases.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {SERVICE_CATEGORIES.map((service) => (
            <div
              key={service.title}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <service.icon className="h-5 w-5 text-[#1D4ED8]" />
                  <span className="text-xs font-medium text-slate-500">{service.phase}</span>
                </div>
                <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
                  {service.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {service.description}
                </p>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                >
                  <span>Discuss deployment scope</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
