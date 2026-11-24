import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, Shield, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTES } from '../../config/permissions';

export function RexonLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          dark ? 'bg-blue-600 text-white' : 'bg-[#0B192C] text-white'
        }`}
      >
        <Shield className="h-4 w-4" />
      </span>
      <span
        className={`font-display text-base font-bold tracking-tight ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        REXON
      </span>
    </span>
  );
}

const PUBLIC_NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Features', to: '/features' },
  { label: 'Plans', to: '/plans' },
  { label: 'Contact Us', to: '/contact' },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { userProfile } = useAuth();

  const dashboardHome = userProfile ? ROLE_HOME_ROUTES[userProfile.role] : '/login';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link to="/" className="whitespace-nowrap shrink-0 focus-visible:outline-none">
            <RexonLogo />
          </Link>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            {PUBLIC_NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                    isActive
                      ? 'border-[#1D4ED8] text-slate-900 font-semibold'
                      : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: Primary Action & Login */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <Link
              to={userProfile ? dashboardHome : '/login'}
              className="whitespace-nowrap shrink-0 text-sm font-medium text-slate-700 hover:text-[#1D4ED8] transition-colors"
            >
              {userProfile ? 'Dashboard' : 'Login'}
            </Link>
            <Link
              to="/contact"
              className="whitespace-nowrap shrink-0 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF] transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-1">
              {PUBLIC_NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-blue-50 text-[#1D4ED8]' : 'text-slate-700 hover:bg-slate-50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
              <Link
                to={userProfile ? dashboardHome : '/login'}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-700"
              >
                {userProfile ? 'Open Dashboard' : 'Login'}
              </Link>
              <Link
                to="/contact"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Quiet Corporate Footer */}
      <footer className="border-t border-slate-200 bg-[#0B192C] text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <RexonLogo dark />
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                REXON MANAGEMENT APP is a multi-tenant smart security, workforce, and facility
                operations platform built for enterprise governance.
              </p>
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-white">Platform</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">
                    Services
                  </Link>
                </li>
                <li>
                  <Link to="/features" className="hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to="/plans" className="hover:text-white transition-colors">
                    Subscription Plans
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-white">Access & Support</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Unified Portal Login
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Request Organization Setup
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Contact Sales & Onboarding
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-white">Contact Channels</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>Onboarding Desk: Configured per deployment</li>
                <li>Office Address: Placeholder — Pending official address</li>
                <li>Support Line: Placeholder — Pending official phone</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} REXON MANAGEMENT APP. All rights reserved.</p>
            <p>Multi-Tenant SaaS Security & Facility Architecture</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
