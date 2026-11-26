import { UserRole } from '../types';

export interface NavItem {
  label: string;
  path: string;
  iconName:
    | 'LayoutDashboard'
    | 'Building2'
    | 'Users'
    | 'CreditCard'
    | 'Receipt'
    | 'FileBarChart'
    | 'Settings'
    | 'UserCircle'
    | 'ShieldCheck'
    | 'Home'
    | 'Layers'
    | 'DoorOpen'
    | 'Building';
  requiredPermission?: string;
}

export const ROLE_NAVIGATION: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard', path: '/super-admin/dashboard', iconName: 'LayoutDashboard' },
    { label: 'Company / Society Management', path: '/super-admin/organizations', iconName: 'Building2' },
    { label: 'Staff Management', path: '/super-admin/staff', iconName: 'Users' },
    { label: 'Subscription Plans', path: '/super-admin/plans', iconName: 'CreditCard' },
    { label: 'Payments', path: '/super-admin/payments', iconName: 'Receipt' },
    { label: 'Reports', path: '/super-admin/reports', iconName: 'FileBarChart' },
    { label: 'Settings', path: '/super-admin/settings', iconName: 'Settings' },
    { label: 'Profile', path: '/super-admin/profile', iconName: 'UserCircle' },
  ],
  super_admin_staff: [
    { label: 'Dashboard', path: '/super-admin-staff/dashboard', iconName: 'LayoutDashboard' },
    {
      label: 'Company / Society',
      path: '/super-admin-staff/organizations',
      iconName: 'Building2',
      requiredPermission: 'manage_organizations',
    },
    {
      label: 'Subscription Plans',
      path: '/super-admin-staff/plans',
      iconName: 'CreditCard',
      requiredPermission: 'manage_plans',
    },
    {
      label: 'Payments',
      path: '/super-admin-staff/payments',
      iconName: 'Receipt',
      requiredPermission: 'view_payments',
    },
    {
      label: 'Reports',
      path: '/super-admin-staff/reports',
      iconName: 'FileBarChart',
      requiredPermission: 'manage_reports',
    },
    {
      label: 'Settings',
      path: '/super-admin-staff/settings',
      iconName: 'Settings',
      requiredPermission: 'access_settings',
    },
    { label: 'Profile', path: '/super-admin-staff/profile', iconName: 'UserCircle' },
  ],
  organization_admin: [
    { label: 'Dashboard', path: '/organization-admin/dashboard', iconName: 'LayoutDashboard' },
    { label: 'Organization Profile', path: '/organization-admin/profile', iconName: 'Building2' },
    { label: 'Staff Management', path: '/organization-admin/staff', iconName: 'Users' },
    { label: 'Property Management', path: '/organization-admin/properties', iconName: 'Home' },
    { label: 'Tower Management', path: '/organization-admin/towers', iconName: 'Building' },
    { label: 'Wing Management', path: '/organization-admin/wings', iconName: 'Layers' },
    { label: 'Flat Management', path: '/organization-admin/flats', iconName: 'DoorOpen' },
    { label: 'Reports', path: '/organization-admin/reports', iconName: 'FileBarChart' },
    { label: 'Subscription', path: '/organization-admin/subscription', iconName: 'CreditCard' },
    { label: 'Settings', path: '/organization-admin/settings', iconName: 'Settings' },
  ],
  organization_staff: [
    { label: 'Dashboard', path: '/organization-staff/dashboard', iconName: 'LayoutDashboard' },
    {
      label: 'Property Overview',
      path: '/organization-staff/properties',
      iconName: 'Home',
      requiredPermission: 'view_properties',
    },
    {
      label: 'Towers',
      path: '/organization-staff/towers',
      iconName: 'Building',
      requiredPermission: 'view_properties',
    },
    {
      label: 'Wings',
      path: '/organization-staff/wings',
      iconName: 'Layers',
      requiredPermission: 'view_properties',
    },
    {
      label: 'Flats',
      path: '/organization-staff/flats',
      iconName: 'DoorOpen',
      requiredPermission: 'view_properties',
    },
    {
      label: 'Staff Directory',
      path: '/organization-staff/staff',
      iconName: 'Users',
      requiredPermission: 'view_staff',
    },
    {
      label: 'Reports',
      path: '/organization-staff/reports',
      iconName: 'FileBarChart',
      requiredPermission: 'view_reports',
    },
    { label: 'My Profile', path: '/organization-staff/profile', iconName: 'UserCircle' },
  ],
};
