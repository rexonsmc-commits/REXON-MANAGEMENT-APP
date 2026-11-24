import { OrgStaffPermissionKey, SuperAdminPermissionKey, UserRole } from '../types';

export const BOOTSTRAPPED_SUPER_ADMIN_EMAIL = 'rexon.smc@gmail.com';

export interface PermissionDefinition<T extends string> {
  key: T;
  canonicalKey: string;
  label: string;
  description: string;
  category: string;
}

export const SUPER_ADMIN_STAFF_PERMISSIONS: PermissionDefinition<SuperAdminPermissionKey>[] = [
  {
    key: 'view_dashboard',
    canonicalKey: 'platform.dashboard.view',
    label: 'View Dashboard',
    description: 'Access platform overview metrics and analytics',
    category: 'Overview',
  },
  {
    key: 'manage_organizations',
    canonicalKey: 'platform.organizations.view',
    label: 'Manage Organizations',
    description: 'View and administer registered tenant organizations',
    category: 'Organizations',
  },
  {
    key: 'create_organizations',
    canonicalKey: 'platform.organizations.create',
    label: 'Create Organizations',
    description: 'Onboard new companies, factories, and societies',
    category: 'Organizations',
  },
  {
    key: 'edit_organizations',
    canonicalKey: 'platform.organizations.edit',
    label: 'Edit Organizations',
    description: 'Modify organization profile and subscription metadata',
    category: 'Organizations',
  },
  {
    key: 'delete_organizations',
    canonicalKey: 'platform.organizations.delete',
    label: 'Delete Organizations',
    description: 'Remove inactive tenant organization records',
    category: 'Organizations',
  },
  {
    key: 'manage_staff',
    canonicalKey: 'platform.staff.view',
    label: 'Manage Staff',
    description: 'View Super Admin Staff directory',
    category: 'Administration',
  },
  {
    key: 'manage_plans',
    canonicalKey: 'platform.subscriptions.edit',
    label: 'Manage Subscription Plans',
    description: 'Create and update platform pricing plans',
    category: 'Billing',
  },
  {
    key: 'view_payments',
    canonicalKey: 'platform.subscriptions.view',
    label: 'View Payments',
    description: 'Inspect subscription payment verification records',
    category: 'Billing',
  },
  {
    key: 'manage_reports',
    canonicalKey: 'platform.reports.view',
    label: 'Manage Reports',
    description: 'Run organization-wise, date-wise, and year-wise reports',
    category: 'Reporting',
  },
  {
    key: 'export_pdf',
    canonicalKey: 'platform.reports.export',
    label: 'Export PDF',
    description: 'Generate downloadable PDF operational reports',
    category: 'Reporting',
  },
  {
    key: 'access_settings',
    canonicalKey: 'platform.settings.view',
    label: 'Access Settings',
    description: 'View platform governance and audit log settings',
    category: 'System',
  },
];

export const ORG_STAFF_PERMISSIONS: PermissionDefinition<OrgStaffPermissionKey>[] = [
  {
    key: 'view_dashboard',
    canonicalKey: 'organization.dashboard.view',
    label: 'View Dashboard',
    description: 'Access organization workspace KPIs and overview',
    category: 'Overview',
  },
  {
    key: 'view_staff',
    canonicalKey: 'organization.staff.view',
    label: 'View Staff Directory',
    description: 'View organization staff and department assignments',
    category: 'Workforce',
  },
  {
    key: 'manage_staff',
    canonicalKey: 'organization.staff.create',
    label: 'Manage Staff',
    description: 'Add, update, and deactivate organization staff records',
    category: 'Workforce',
  },
  {
    key: 'view_properties',
    canonicalKey: 'organization.properties.view',
    label: 'View Properties',
    description: 'Inspect towers, wings, and flat occupancy records',
    category: 'Property',
  },
  {
    key: 'manage_properties',
    canonicalKey: 'organization.properties.manage',
    label: 'Manage Properties',
    description: 'Add and update towers, wings, and flat records',
    category: 'Property',
  },
  {
    key: 'view_reports',
    canonicalKey: 'organization.reports.view',
    label: 'View Reports',
    description: 'Filter and review organization operational summaries',
    category: 'Reporting',
  },
  {
    key: 'export_pdf',
    canonicalKey: 'organization.reports.export',
    label: 'Export PDF',
    description: 'Export staff, tower, wing, and flat PDF reports',
    category: 'Reporting',
  },
  {
    key: 'access_settings',
    canonicalKey: 'organization.profile.edit',
    label: 'Access Settings',
    description: 'View organization configuration and audit history',
    category: 'System',
  },
];

export const PERMISSION_ALIAS_MAP: Record<string, string[]> = {
  // Phase 1 -> Phase 2 canonical equivalents and vice-versa
  view_dashboard: ['platform.dashboard.view', 'organization.dashboard.view'],
  manage_organizations: ['platform.organizations.view', 'platform.organizations.create', 'platform.organizations.edit'],
  create_organizations: ['platform.organizations.create'],
  edit_organizations: ['platform.organizations.edit'],
  delete_organizations: ['platform.organizations.delete'],
  manage_staff: ['platform.staff.view', 'platform.staff.create', 'platform.staff.edit', 'organization.staff.create', 'organization.staff.edit'],
  manage_plans: ['platform.subscriptions.create', 'platform.subscriptions.edit', 'platform.subscriptions.delete'],
  view_payments: ['platform.subscriptions.view'],
  manage_reports: ['platform.reports.view'],
  export_pdf: ['platform.reports.export', 'organization.reports.export'],
  view_staff: ['organization.staff.view'],
  view_properties: ['organization.properties.view'],
  manage_properties: ['organization.properties.manage'],
  view_reports: ['organization.reports.view'],
  access_settings: ['organization.profile.edit', 'platform.settings.view'],
  'platform.dashboard.view': ['view_dashboard'],
  'platform.organizations.view': ['manage_organizations'],
  'platform.organizations.create': ['create_organizations', 'manage_organizations'],
  'platform.organizations.edit': ['edit_organizations', 'manage_organizations'],
  'platform.organizations.delete': ['delete_organizations'],
  'platform.staff.view': ['manage_staff'],
  'platform.staff.create': ['manage_staff'],
  'platform.staff.edit': ['manage_staff'],
  'platform.staff.delete': ['manage_staff'],
  'platform.subscriptions.view': ['view_payments', 'manage_plans'],
  'platform.subscriptions.create': ['manage_plans'],
  'platform.subscriptions.edit': ['manage_plans'],
  'platform.subscriptions.delete': ['manage_plans'],
  'platform.reports.view': ['manage_reports'],
  'platform.reports.export': ['export_pdf'],
  'organization.dashboard.view': ['view_dashboard'],
  'organization.profile.view': ['view_dashboard'],
  'organization.profile.edit': ['access_settings'],
  'organization.staff.view': ['view_staff', 'manage_staff'],
  'organization.staff.create': ['manage_staff'],
  'organization.staff.edit': ['manage_staff'],
  'organization.staff.delete': ['manage_staff'],
  'organization.roles.manage': ['manage_staff'],
  'organization.properties.view': ['view_properties', 'manage_properties'],
  'organization.properties.manage': ['manage_properties'],
  'organization.reports.view': ['view_reports'],
  'organization.reports.export': ['export_pdf'],
};

export const EXAMPLE_ORG_DEPARTMENTS = [
  'HR',
  'Security',
  'Accounts',
  'Administration',
  'Operations',
  'Maintenance',
  'Management',
  'Reception',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  super_admin_staff: 'Super Admin Staff',
  organization_admin: 'Organization Admin',
  organization_staff: 'Organization Staff',
};

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  super_admin: '/super-admin/dashboard',
  super_admin_staff: '/super-admin-staff/dashboard',
  organization_admin: '/organization-admin/dashboard',
  organization_staff: '/organization-staff/dashboard',
};

// Blueprint-synchronized volumetric limits
export const FIELD_LIMITS = {
  NAME_MAX: 120,
  ORG_NAME_MAX: 160,
  EMAIL_MAX: 160,
  PHONE_MAX: 40,
  ADDRESS_MAX: 300,
  DESCRIPTION_MAX: 300,
  MESSAGE_MAX: 2000,
};
