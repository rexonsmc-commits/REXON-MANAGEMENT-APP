import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTES } from '../../config/permissions';

export function UnauthorizedPage() {
  const { userProfile } = useAuth();
  const home = userProfile ? ROLE_HOME_ROUTES[userProfile.role] : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
          Insufficient Module Permissions
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account does not currently hold the required permission to access this section.
          Contact your administrator if you require elevated module access.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to={home}
            className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF]"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
