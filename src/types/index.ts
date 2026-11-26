export type UserRole =
  | 'super_admin'
  | 'super_admin_staff'
  | 'organization_admin'
  | 'organization_staff';

export type AccountStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'disabled';

export type OrganizationType =
  | 'Company'
  | 'Factory'
  | 'Society'
  | 'Apartment'
  | 'Industry'
  | 'Commercial Building'
  | 'Other';

export type SubscriptionStatus =
  | 'Pending'
  | 'Active'
  | 'Expired'
  | 'Suspended'
  | 'Cancelled';

export type BillingCycle = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

export type OccupancyType = 'Owner Occupied' | 'Tenant Occupied' | 'Vacant';

export type PaymentVerificationStatus = 'Pending Verification' | 'Verified' | 'Rejected';

export type SuperAdminPermissionKey =
  | 'view_dashboard'
  | 'manage_organizations'
  | 'create_organizations'
  | 'edit_organizations'
  | 'delete_organizations'
  | 'manage_staff'
  | 'manage_plans'
  | 'view_payments'
  | 'manage_reports'
  | 'export_pdf'
  | 'access_settings'
  | 'platform.dashboard.view'
  | 'platform.organizations.view'
  | 'platform.organizations.create'
  | 'platform.organizations.edit'
  | 'platform.organizations.delete'
  | 'platform.staff.view'
  | 'platform.staff.create'
  | 'platform.staff.edit'
  | 'platform.staff.delete'
  | 'platform.subscriptions.view'
  | 'platform.subscriptions.create'
  | 'platform.subscriptions.edit'
  | 'platform.subscriptions.delete'
  | 'platform.reports.view'
  | 'platform.reports.export';

export type OrgStaffPermissionKey =
  | 'view_dashboard'
  | 'view_staff'
  | 'manage_staff'
  | 'view_properties'
  | 'manage_properties'
  | 'view_reports'
  | 'export_pdf'
  | 'access_settings'
  | 'organization.dashboard.view'
  | 'organization.profile.view'
  | 'organization.profile.edit'
  | 'organization.staff.view'
  | 'organization.staff.create'
  | 'organization.staff.edit'
  | 'organization.staff.delete'
  | 'organization.roles.manage'
  | 'organization.properties.view'
  | 'organization.properties.manage'
  | 'organization.reports.view'
  | 'organization.reports.export';

export type PermissionKey = SuperAdminPermissionKey | OrgStaffPermissionKey;

export interface SystemConfigMain {
  superAdminUid: string;
  email?: string;
  initialized: boolean;
  platformName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName?: string;
  phone?: string;
  loginId?: string;
  role: UserRole;
  organizationId?: string;
  organizationName?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  permissions: string[];
  status: AccountStatus;
  accountStatus?: AccountStatus;
  emailVerified?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export interface InvitedAccount {
  uid?: string;
  email: string;
  displayName: string;
  phone?: string;
  loginId?: string;
  employeeId?: string;
  role: Exclude<UserRole, 'super_admin'>;
  organizationId?: string;
  organizationName?: string;
  designation?: string;
  department?: string;
  permissions: string[];
  status: AccountStatus;
  invitedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Organization {
  id: string;
  organizationId?: string;
  name: string;
  type: OrganizationType;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  adminLoginEmail: string;
  adminLoginId?: string;
  adminUid?: string;
  subscriptionPlanId?: string;
  subscriptionPlanName?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  accountStatus: AccountStatus;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SuperAdminStaff {
  id: string;
  uid?: string;
  name: string;
  email: string;
  phone?: string;
  loginId?: string;
  designation: string;
  department: string;
  assignedRole: string;
  permissions: SuperAdminPermissionKey[];
  status: AccountStatus;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrganizationStaff {
  id: string;
  uid?: string;
  organizationId: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  loginId?: string;
  designation: string;
  department: string;
  role: string;
  permissions: OrgStaffPermissionKey[];
  status: AccountStatus;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoleTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  permissions: OrgStaffPermissionKey[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  targetAudience?: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  halfYearlyPrice: number;
  yearlyPrice: number;
  features: string[];
  maxStaff: number;
  maxSites: number;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subscription {
  id: string;
  organizationId: string;
  organizationName?: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string;
  verifiedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  referenceCode: string;
  verificationStatus: PaymentVerificationStatus;
  verifiedBy?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Tower {
  id: string;
  organizationId: string;
  name: string;
  towerNumber: string;
  description?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Wing {
  id: string;
  organizationId: string;
  towerId: string;
  towerName?: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Flat {
  id: string;
  organizationId: string;
  towerId: string;
  towerName?: string;
  wingId: string;
  wingName?: string;
  flatNumber: string;
  floorNumber: string;
  flatType: string;
  ownerName: string;
  ownerContact?: string;
  ownerEmail?: string;
  occupancyType: OccupancyType;
  tenantName?: string;
  tenantContact?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ContactMessage {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'new' | 'reviewed' | 'archived';
  createdAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  organizationId?: string;
  action: string;
  targetCollection: string;
  targetId: string;
  targetUserId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
}
