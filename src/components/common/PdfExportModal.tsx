import { useEffect, useState } from 'react';
import { Calendar, Download, Filter } from 'lucide-react';
import { Modal } from './Modal';
import {
  DateFilterCriteria,
  describeDateFilter,
  PdfDateFilterMode,
} from '../../utils/subscriptionHelpers';

export interface PdfExportCompanyOption {
  id: string;
  name: string;
}

export interface PdfFilterValues {
  dateFilter: DateFilterCriteria;
  companyId: string;
  extraFilter: string;
}

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  companies?: PdfExportCompanyOption[];
  companyFilterLabel?: string;
  extraFilterLabel?: string;
  extraFilterOptions?: { label: string; value: string }[];
  getMatchCount: (filters: PdfFilterValues) => number;
  onExport: (filters: PdfFilterValues, filterSummary: string) => void;
}

const NOW = new Date();
const DEFAULT_MONTH = NOW.toISOString().slice(0, 7);
const DEFAULT_YEAR = String(NOW.getFullYear());
const DEFAULT_FROM = `${NOW.getFullYear()}-01-01`;
const DEFAULT_TO = NOW.toISOString().slice(0, 10);

export function PdfExportModal({
  open,
  onClose,
  title,
  description = 'Filter records by Month, Date Range, Year, or Company / Society before downloading PDF.',
  companies,
  companyFilterLabel = 'Company / Society',
  extraFilterLabel,
  extraFilterOptions,
  getMatchCount,
  onExport,
}: PdfExportModalProps) {
  const [mode, setMode] = useState<PdfDateFilterMode>('all');
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_TO);
  const [companyId, setCompanyId] = useState('all');
  const [extraFilter, setExtraFilter] = useState('all');

  useEffect(() => {
    if (open) {
      setMode('all');
      setCompanyId('all');
      setExtraFilter('all');
    }
  }, [open]);

  const currentFilters: PdfFilterValues = {
    dateFilter: { mode, month, year, dateFrom, dateTo },
    companyId,
    extraFilter,
  };

  const matchCount = open ? getMatchCount(currentFilters) : 0;

  const buildSummary = () => {
    const parts: string[] = [describeDateFilter(currentFilters.dateFilter)];
    if (companies && companies.length > 0) {
      const compName =
        companyId === 'all'
          ? 'All Companies / Societies'
          : companies.find((c) => c.id === companyId)?.name || companyId;
      parts.push(`${companyFilterLabel}: ${compName}`);
    }
    if (extraFilterLabel && extraFilterOptions && extraFilter !== 'all') {
      const label =
        extraFilterOptions.find((o) => o.value === extraFilter)?.label || extraFilter;
      parts.push(`${extraFilterLabel}: ${label}`);
    }
    return parts.join('  |  ');
  };

  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(currentFilters, buildSummary());
    onClose();
  };

  const currentYearNum = NOW.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYearNum - 4 + i));

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={description} maxWidth="lg">
      <form onSubmit={handleDownload} className="space-y-4">
        {/* Period Filter Mode */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-[#1D4ED8]" />
            <span>Period / Date Filter</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                { id: 'all', label: 'All Records' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'range', label: 'Date-wise' },
                { id: 'yearly', label: 'Yearly' },
              ] as { id: PdfDateFilterMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === opt.id
                    ? 'border-[#1D4ED8] bg-blue-50 text-[#1D4ED8]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional Period Inputs */}
        {mode === 'monthly' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700">Select Month *</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
        )}

        {mode === 'yearly' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700">Select Year *</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'range' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Company / Society & Optional Extra Filter */}
        {(companies && companies.length > 0) || (extraFilterOptions && extraFilterOptions.length > 0) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {companies && companies.length > 0 && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  <span>{companyFilterLabel}</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                >
                  <option value="all">All Companies / Societies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {extraFilterOptions && extraFilterOptions.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {extraFilterLabel || 'Filter'}
                </label>
                <select
                  value={extraFilter}
                  onChange={(e) => setExtraFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                >
                  {extraFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
          <span className="text-slate-600">Matching records for export</span>
          <span className="font-mono font-bold text-slate-900 tabular-nums">
            {matchCount} {matchCount === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={matchCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF ({matchCount})</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
