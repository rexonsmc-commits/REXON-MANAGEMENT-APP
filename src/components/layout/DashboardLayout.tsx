import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Building2,
  ChevronRight,
  CreditCard,
  DoorOpen,
  Eye,
  FileBarChart,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneCall,
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
import { getSubscriptionExpiryInfo } from '../../utils/subscriptionHelpers';
import { DirectPaymentModal } from '../common/DirectPaymentModal';
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
  const [payModalOpen, setPayModalOpen] = useState(false);
  const {
    userProfile,
    realRole,
    organization,
    isInspectingOrganization,
    exitOrganizationPortal,
    inspectedStaff,
    isInspectingStaff,
    exitStaffPortal,
    signOut,
    hasPermission,
  } = useAuth();
  const navigate = useNavigate();

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

  const expiryInfo = getSubscriptionExpiryInfo(organization);
  const showSubscriptionAlert = isTenantPortal && organization && expiryInfo.isAlertRequired;
  const isExpiredOrSuspended =
    expiryInfo.urgency === 'expired' || organization?.subscriptionStatus === 'Suspended';

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
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-slate-800 bg-[#0B192C] text-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 ${
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
          {isInspectingStaff && inspectedStaff && (
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-[#0B192C] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      {realRole === 'super_admin'
                        ? 'Super Admin Staff Inspection Mode'
                        : 'Admin Staff Inspection Mode'}
                    </span>
                    {inspectedStaff.staff.isHidden && (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                        Hidden from Staff Login
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    Viewing {inspectedStaff.staff.name} ({inspectedStaff.staff.email})
                    {organization?.name ? ` · ${organization.name}` : ''}
                  </p>
                  <p className="text-xs text-slate-300">
                    Permissions scoped strictly to {inspectedStaff.staff.permissions.length}{' '}
                    assigned module{inspectedStaff.staff.permissions.length === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const targetPath =
                    inspectedStaff.kind === 'super_admin_staff'
                      ? '/super-admin/staff'
                      : '/organization-admin/staff';
                  exitStaffPortal();
                  navigate(targetPath);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-[#0B192C] hover:bg-emerald-50 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>
                  {inspectedStaff.kind === 'super_admin_staff'
                    ? 'Exit to Super Admin Portal'
                    : 'Exit to Staff Management'}
                </span>
              </button>
            </div>
          )}

          {!isInspectingStaff && isInspectingOrganization && organization && (
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-blue-200 bg-[#0B192C] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                      Super Admin Full Access Mode
                    </span>
                    {organization.isHidden && (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                        Hidden from Company / Society Users
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    Viewing {organization.name} ({organization.type})
                  </p>
                  <p className="text-xs text-slate-300">
                    Full A-to-Z permissions enabled: edit, add, remove, delete, or download any
                    record without entering tenant credentials.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  exitOrganizationPortal();
                  navigate('/super-admin/organizations');
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-[#0B192C] hover:bg-blue-50 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Exit to Super Admin Portal</span>
              </button>
            </div>
          )}

          {subtitle && (
            <p className="mb-5 text-sm text-slate-600">{subtitle}</p>
          )}

          {showSubscriptionAlert && (
            <div
              className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                isExpiredOrSuspended
                  ? 'border-rose-300 bg-rose-50'
                  : 'border-amber-300 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    isExpiredOrSuspended ? 'text-rose-700' : 'text-amber-700'
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-bold ${
                      isExpiredOrSuspended ? 'text-rose-950' : 'text-amber-950'
                    }`}
                  >
                    {expiryInfo.urgency === 'expiring_soon'
                      ? `Subscription Expiring Soon — ${expiryInfo.label}`
                      : `Subscription Alert — ${expiryInfo.label}`}
                  </p>
                  <p
                    className={`mt-0.5 text-xs ${
                      isExpiredOrSuspended ? 'text-rose-800' : 'text-amber-900'
                    }`}
                  >
                    {organization?.name} ({organization?.subscriptionPlanName || 'Active Plan'}) ·{' '}
                    {organization?.subscriptionExpiryDate
                      ? `Expiry Date: ${organization.subscriptionExpiryDate}`
                      : `Status: ${organization?.subscriptionStatus}`}
                    . Direct phone payment &amp; renewal verification is required to keep all
                    modules active.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white whitespace-nowrap ${
                    isExpiredOrSuspended
                      ? 'bg-rose-700 hover:bg-rose-800'
                      : 'bg-amber-900 hover:bg-amber-800'
                  }`}
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Pay Now / Renew</span>
                </button>
              </div>
            </div>
          )}

          {children}
        </main>
      </div>

      <DirectPaymentModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        organization={organization}
        canSubmitReference={userProfile.role === 'organization_admin'}
      />
    </div>
  );
}
