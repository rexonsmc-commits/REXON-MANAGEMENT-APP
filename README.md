# REXON MANAGEMENT APP

Multi-tenant SaaS Security, Facility, Society, Factory, and Workforce Management Platform built with React, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, and Firebase Cloud Functions.

---

## Architecture Overview

### Four User Portals & Single Unified Login (`/login`)
All users authenticate at `/login` without selecting a role from the frontend. Their role, tenant boundary (`organizationId`), account status, and granular permissions are resolved server-side from Firebase Authentication and Firestore:

1. **Super Admin (`super_admin`)** — Single master account enforced via `systemConfig/main` + `systemConfig/superAdmin` singleton invariants (`/super-admin/*`).
2. **Super Admin Staff (`super_admin_staff`)** — Global operations staff with individually assigned `platform.*` permissions (`/super-admin-staff/*`).
3. **Organization Admin (`organization_admin`)** — Tenant-isolated administrator for a Company, Factory, Society, Apartment, Commercial Building, or Industry (`/organization-admin/*`, `/organization/dashboard`).
4. **Organization Staff (`organization_staff`)** — Tenant-isolated staff with departmental and role-based `organization.*` permissions (`/organization-staff/*`).

### Account Lifecycle & Enforcement
- Supported account statuses: `pending`, `active`, `inactive`, `suspended`, `disabled`.
- `ProtectedRoute`, `RoleGuard`, `PermissionGuard`, and `OrganizationGuard` enforce authentication, role boundaries, granular permissions, active account status, active organization status, and operational subscription status.

---

## Environment Variables

Copy `.env.example` to `.env` for local development or configure your hosting environment:

```bash
# Optional overrides (firebase-applet-config.json provides defaults in AI Studio)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_FIRESTORE_DATABASE_ID=

# Phase 2 Cloud Functions, App Check & Emulator toggles
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
VITE_FIREBASE_APP_CHECK_SITE_KEY=
VITE_USE_CLOUD_FUNCTIONS=false
VITE_USE_FIREBASE_EMULATORS=false

# Server-side Cloud Functions configuration (never expose in frontend .env)
SUPER_ADMIN_BOOTSTRAP_SECRET=
SUPER_ADMIN_BOOTSTRAP_EMAIL=rexon.smc@gmail.com
```

---

## Firebase Console Configuration Checklist

1. **Authentication Providers**:
   - Open Firebase Console -> **Authentication -> Sign-in method**.
   - Enable **Google** (configured by default).
   - Enable **Email/Password** so provisioned admins and staff can sign in with email/Login ID + password and reset passwords.
2. **Firestore Database & Indexes**:
   - Rules are stored in `firestore.rules`.
   - Composite indexes are defined in `firestore.indexes.json`.
3. **Firebase App Check (Recommended for Production)**:
   - Register a reCAPTCHA v3 key in Firebase Console -> **App Check** and set `VITE_FIREBASE_APP_CHECK_SITE_KEY`.

---

## Local Development & Firebase Emulator Suite

Install root dependencies and run Vite:

```bash
npm install
npm run dev
```

To install Cloud Functions dependencies and build `functions/`:

```bash
cd functions
npm install
npm run build
cd ..
```

To run Firebase Emulators locally (Auth `:9099`, Functions `:5001`, Firestore `:8080`, Emulator UI `:4000`):

```bash
VITE_USE_FIREBASE_EMULATORS=true firebase emulators:start
```

To run Firestore Security Rules tests against the Firestore Emulator:

```bash
firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
```

---

## Production Deployment

1. **Deploy Firestore Rules & Composite Indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

2. **Deploy Firebase Cloud Functions** (requires Firebase Blaze plan):
   ```bash
   cd functions && npm install && npm run build && cd ..
   firebase deploy --only functions
   ```
   After deploying Cloud Functions, set `VITE_USE_CLOUD_FUNCTIONS=true` in your frontend build environment.

3. **Initialize Single Super Admin Master Account**:
   - Sign in with the authorized master email (`rexon.smc@gmail.com`) via Google Sign-In, OR call `initializeSuperAdmin` with the `SUPER_ADMIN_BOOTSTRAP_SECRET` configured on Cloud Functions.
   - `systemConfig/main` and `systemConfig/superAdmin` lock once initialized so no second Super Admin can ever be created.

4. **Build & Host Frontend**:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
