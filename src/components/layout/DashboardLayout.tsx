import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building,
  Building2,
  ChevronRight,
  CreditCard,
  DoorOpen,
  FileBarChart,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { NavItem, ROLE_NAVIGATION } from '../../config/navigation';
import { ROLE_LABELS } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { RexonLogo } from './PublicLayout';

const ICON_MAP: Record<NavItem['iconName'], React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Receipt,
  FileBarChart,
  Settings,
  UserCircle,
  ShieldCheck,
  Home,
  Layers,
  DoorOpen,
  Building,
};

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardLayout({ title, subtitle, actions, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userProfile, organization, signOut, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!userProfile) return null;

  const navItems = (ROLE_NAVIGATION[userProfile.role] || []).filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(item.requiredPermission);
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const roleLabel = ROLE_LABELS[userProfile.role];
  const isTenantPortal =
    userProfile.role === 'organization_admin' || userProfile.role === 'organization_staff';

  const subscriptionInactive =
    isTenantPortal && organization && organization.subscriptionStatus !== 'Active';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-slate-800 bg-[#0B192C] text-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <Link to="/" className="focus-visible:outline-none">
            <RexonLogo dark />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace Context */}
        <div className="border-b border-slate-800/80 px-5 py-3.5">
          <p className="text-xs font-medium text-blue-300">{roleLabel}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {organization?.name || userProfile.organizationName || 'Global Platform Control'}
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.iconName];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-rose-950/60 hover:text-rose-200 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <span>{roleLabel}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate font-medium text-slate-700">{title}</span>
              </div>
              <h1 className="truncate font-display text-lg font-bold text-slate-900 sm:text-xl">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {actions}
            <div className="hidden md:flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-900 max-w-[160px] truncate">
                  {userProfile.displayName}
                </p>
                <p className="text-[11px] text-slate-500 max-w-[160px] truncate">
                  {userProfile.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {subtitle && (
            <p className="mb-5 text-sm text-slate-600">{subtitle}</p>
          )}

          {subscriptionInactive && !location.pathname.endsWith('/subscription') && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Organization Subscription Status: {organization?.subscriptionStatus}
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Active subscription verification by Super Admin is required to unlock full
                  operational modules.
                </p>
              </div>
              {userProfile.role === 'organization_admin' && (
                <Link
                  to="/organization-admin/subscription"
                  className="shrink-0 rounded-lg bg-amber-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-800 whitespace-nowrap"
                >
                  View Subscription Status
                </Link>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
