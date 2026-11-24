import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Public Pages
import { HomePage } from './pages/public/HomePage';
import { AboutPage } from './pages/public/AboutPage';
import { ServicesPage } from './pages/public/ServicesPage';
import { FeaturesPage } from './pages/public/FeaturesPage';
import { PlansPage } from './pages/public/PlansPage';
import { ContactPage } from './pages/public/ContactPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage';

// Shared Profile
import { ProfilePage } from './pages/common/ProfilePage';

// Super Admin & Super Admin Staff Pages
import { SuperAdminDashboard } from './pages/super-admin/SuperAdminDashboard';
import { OrganizationsPage } from './pages/super-admin/OrganizationsPage';
import { SuperAdminStaffPage } from './pages/super-admin/SuperAdminStaffPage';
import { SubscriptionPlansPage } from './pages/super-admin/SubscriptionPlansPage';
import { PaymentsPage } from './pages/super-admin/PaymentsPage';
import { SuperAdminReportsPage } from './pages/super-admin/SuperAdminReportsPage';
import { SuperAdminSettingsPage } from './pages/super-admin/SuperAdminSettingsPage';
import { SuperAdminStaffDashboard } from './pages/super-admin-staff/SuperAdminStaffDashboard';

// Organization Admin & Organization Staff Pages
import { OrgAdminDashboard } from './pages/organization-admin/OrgAdminDashboard';
import { OrgProfilePage } from './pages/organization-admin/OrgProfilePage';
import { OrgStaffPage } from './pages/organization-admin/OrgStaffPage';
import { OrgRolesPage } from './pages/organization-admin/OrgRolesPage';
import { PropertyOverviewPage } from './pages/organization-admin/PropertyOverviewPage';
import { TowersPage } from './pages/organization-admin/TowersPage';
import { WingsPage } from './pages/organization-admin/WingsPage';
import { FlatsPage } from './pages/organization-admin/FlatsPage';
import { OrgReportsPage } from './pages/organization-admin/OrgReportsPage';
import { OrgSubscriptionPage } from './pages/organization-admin/OrgSubscriptionPage';
import { OrgSettingsPage } from './pages/organization-admin/OrgSettingsPage';
import { OrgStaffDashboard } from './pages/organization-staff/OrgStaffDashboard';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Website */}
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/contact" element={<ContactPage />} />

              {/* Unified Login & Unauthorized */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* 1. SUPER ADMIN PORTAL */}
              <Route
                path="/super-admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/organizations"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <OrganizationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/staff"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <SuperAdminStaffPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/plans"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <SubscriptionPlansPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/payments"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <SuperAdminReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <SuperAdminSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/profile"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* 2. SUPER ADMIN STAFF PORTAL */}
              <Route
                path="/super-admin-staff/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['super_admin_staff']}>
                    <SuperAdminStaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-staff/organizations"
                element={
                  <ProtectedRoute
                    allowedRoles={['super_admin_staff']}
                    requiredPermission="manage_organizations"
                  >
                    <OrganizationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-staff/plans"
                element={
                  <ProtectedRoute
                    allowedRoles={['super_admin_staff']}
                    requiredPermission="manage_plans"
                  >
                    <SubscriptionPlansPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-staff/payments"
                element={
                  <ProtectedRoute
                    allowedRoles={['super_admin_staff']}
                    requiredPermission="view_payments"
                  >
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-staff/reports"
                element={
                  <ProtectedRoute
                    allowedRoles={['super_admin_staff']}
                    requiredPermission="manage_reports"
                  >
                    <SuperAdminReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-staff/settings"
                element={
                  <ProtectedRoute
                    allowedRoles={['super_admin_staff']}
                    requiredPermission="access_settings"
                  >
                    <SuperAdminSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-staff/profile"
                element={
                  <ProtectedRoute allowedRoles={['super_admin_staff']}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* 3. COMPANY / FACTORY / SOCIETY ADMIN PORTAL */}
              <Route
                path="/organization/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgAdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgAdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/profile"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/staff"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgStaffPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/roles"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/properties"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <PropertyOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/towers"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <TowersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/wings"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <WingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/flats"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <FlatsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/subscription"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgSubscriptionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['organization_admin']}>
                    <OrgSettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* 4. COMPANY / FACTORY / SOCIETY STAFF PORTAL */}
              <Route
                path="/organization-staff/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['organization_staff']}>
                    <OrgStaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/properties"
                element={
                  <ProtectedRoute
                    allowedRoles={['organization_staff']}
                    requiredPermission="view_properties"
                  >
                    <PropertyOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/towers"
                element={
                  <ProtectedRoute
                    allowedRoles={['organization_staff']}
                    requiredPermission="view_properties"
                  >
                    <TowersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/wings"
                element={
                  <ProtectedRoute
                    allowedRoles={['organization_staff']}
                    requiredPermission="view_properties"
                  >
                    <WingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/flats"
                element={
                  <ProtectedRoute
                    allowedRoles={['organization_staff']}
                    requiredPermission="view_properties"
                  >
                    <FlatsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/staff"
                element={
                  <ProtectedRoute
                    allowedRoles={['organization_staff']}
                    requiredPermission="view_staff"
                  >
                    <OrgStaffPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/reports"
                element={
                  <ProtectedRoute
                    allowedRoles={['organization_staff']}
                    requiredPermission="view_reports"
                  >
                    <OrgReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organization-staff/profile"
                element={
                  <ProtectedRoute allowedRoles={['organization_staff']}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
