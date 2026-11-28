import { Organization } from '../types';

export type SubscriptionUrgency = 'expired' | 'expiring_soon' | 'warning_status' | 'healthy';

export interface SubscriptionExpiryInfo {
  daysRemaining: number | null;
  urgency: SubscriptionUrgency;
  label: string;
  isAlertRequired: boolean;
}

export type PdfDateFilterMode = 'all' | 'monthly' | 'range' | 'yearly';

export interface DateFilterCriteria {
  mode: PdfDateFilterMode;
  month?: string; // YYYY-MM
  year?: string; // YYYY
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
}

/**
 * Safely converts a Firestore Timestamp, {seconds}, Date, or ISO/date string to a JS Date.
 */
export function toDateObj(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && value !== null) {
    const maybeTs = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      const d = maybeTs.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof maybeTs.seconds === 'number') {
      const d = new Date(maybeTs.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDisplayDate(value: unknown): string {
  const d = toDateObj(value);
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

/**
 * Format Indian Rupee amount cleanly for React UI (₹1,499).
 */
export function formatINR(amount: number | string | undefined | null): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Format currency dynamically for UI tables (maps INR -> ₹, others fallback gracefully).
 */
export function formatCurrencyAmount(amount: number, currency?: string): string {
  const code = (currency || 'INR').toUpperCase();
  if (code === 'INR' || code === 'RS' || code === '₹' || code === 'USD') {
    return formatINR(amount);
  }
  return `${code} ${Number(amount).toLocaleString('en-IN')}`;
}

/**
 * Safe currency formatting for jsPDF (Helvetica built-in font lacks U+20B9 '₹').
 */
export function formatCurrencyForPdf(amount: number, currency?: string): string {
  const code = (currency || 'INR').toUpperCase();
  if (code === 'INR' || code === 'RS' || code === '₹' || code === 'USD') {
    return `Rs. ${Number(amount).toLocaleString('en-IN')}`;
  }
  return `${code} ${Number(amount).toLocaleString('en-IN')}`;
}

/**
 * Computes subscription urgency & days left relative to today.
 * Threshold for "expiring soon" is 30 days.
 */
export function getSubscriptionExpiryInfo(
  org?: Partial<Organization> | null,
  expiringWindowDays = 30
): SubscriptionExpiryInfo {
  if (!org) {
    return {
      daysRemaining: null,
      urgency: 'healthy',
      label: 'Unknown',
      isAlertRequired: false,
    };
  }

  let daysRemaining: number | null = null;
  if (org.subscriptionExpiryDate) {
    const expiry = toDateObj(`${org.subscriptionExpiryDate}T23:59:59`);
    if (expiry) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffMs = expiry.getTime() - today.getTime();
      daysRemaining = Math.floor(diffMs / 86400000);
    }
  }

  if (org.subscriptionStatus === 'Expired' || (daysRemaining !== null && daysRemaining < 0)) {
    const overdueDays = daysRemaining !== null && daysRemaining < 0 ? Math.abs(daysRemaining) : null;
    return {
      daysRemaining,
      urgency: 'expired',
      label: overdueDays ? `Expired (${overdueDays}d ago)` : 'Expired',
      isAlertRequired: true,
    };
  }

  if (
    org.subscriptionStatus === 'Suspended' ||
    org.subscriptionStatus === 'Pending' ||
    org.subscriptionStatus === 'Cancelled'
  ) {
    return {
      daysRemaining,
      urgency: 'warning_status',
      label: `${org.subscriptionStatus} Subscription`,
      isAlertRequired: true,
    };
  }

  if (daysRemaining !== null && daysRemaining <= expiringWindowDays) {
    return {
      daysRemaining,
      urgency: 'expiring_soon',
      label:
        daysRemaining === 0
          ? 'Expires Today'
          : `Expiring in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      isAlertRequired: true,
    };
  }

  return {
    daysRemaining,
    urgency: 'healthy',
    label: daysRemaining !== null ? `${daysRemaining} days left` : 'Active',
    isAlertRequired: false,
  };
}

/**
 * Sorts organizations so Expired, Expiring Soon, and Pending/Suspended appear at the top,
 * followed by healthy Active ones ordered by nearest expiry date.
 */
export function sortOrganizationsByExpiry(orgs: Organization[]): Organization[] {
  const bucketRank: Record<SubscriptionUrgency, number> = {
    expired: 0,
    expiring_soon: 1,
    warning_status: 2,
    healthy: 3,
  };

  return [...orgs].sort((a, b) => {
    const infoA = getSubscriptionExpiryInfo(a);
    const infoB = getSubscriptionExpiryInfo(b);
    const rankDiff = bucketRank[infoA.urgency] - bucketRank[infoB.urgency];
    if (rankDiff !== 0) return rankDiff;

    const daysA = infoA.daysRemaining ?? Number.MAX_SAFE_INTEGER;
    const daysB = infoB.daysRemaining ?? Number.MAX_SAFE_INTEGER;
    if (daysA !== daysB) return daysA - daysB;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Checks whether a timestamp or date string satisfies Monthly / Date-Range / Yearly filters.
 */
export function matchesDateFilter(dateValue: unknown, criteria: DateFilterCriteria): boolean {
  if (criteria.mode === 'all') return true;
  const d = toDateObj(dateValue);
  if (!d) return false;
  const isoDay = d.toISOString().slice(0, 10);

  if (criteria.mode === 'monthly') {
    if (!criteria.month) return true;
    return isoDay.slice(0, 7) === criteria.month;
  }

  if (criteria.mode === 'yearly') {
    if (!criteria.year) return true;
    return isoDay.slice(0, 4) === criteria.year;
  }

  if (criteria.mode === 'range') {
    if (criteria.dateFrom && isoDay < criteria.dateFrom) return false;
    if (criteria.dateTo && isoDay > criteria.dateTo) return false;
    return true;
  }

  return true;
}

export function describeDateFilter(criteria: DateFilterCriteria): string {
  if (criteria.mode === 'all') return 'All Dates';
  if (criteria.mode === 'monthly') return `Month: ${criteria.month || 'All'}`;
  if (criteria.mode === 'yearly') return `Year: ${criteria.year || 'All'}`;
  const from = criteria.dateFrom || 'Start';
  const to = criteria.dateTo || 'Present';
  return `Range: ${from} to ${to}`;
}
