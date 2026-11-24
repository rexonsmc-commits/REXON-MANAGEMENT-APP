import { CheckCircle2, Clock, XCircle, Ban } from 'lucide-react';

interface StatusLabelProps {
  status: string;
}

export function StatusLabel({ status }: StatusLabelProps) {
  const normalized = status.toLowerCase();

  if (normalized === 'active' || normalized === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }

  if (normalized === 'pending' || normalized === 'pending verification' || normalized === 'new') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 whitespace-nowrap">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }

  if (
    normalized === 'expired' ||
    normalized === 'rejected' ||
    normalized === 'cancelled' ||
    normalized === 'suspended' ||
    normalized === 'disabled'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 whitespace-nowrap">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap">
      <Ban className="h-3.5 w-3.5 shrink-0" />
      <span className="capitalize">{status}</span>
    </span>
  );
}
