import { Database, Eye } from 'lucide-react';

interface DemoDataBannerProps {
  isDemoMode: boolean;
  onToggleDemo?: () => void;
  liveCount?: number;
  label?: string;
}

export function DemoDataBanner({
  isDemoMode,
  onToggleDemo,
  liveCount,
  label = 'records',
}: DemoDataBannerProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        isDemoMode
          ? 'border-amber-200 bg-amber-50/70 text-amber-950'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      <div className="flex items-start gap-3 sm:items-center">
        {isDemoMode ? (
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 sm:mt-0" />
        ) : (
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8] sm:mt-0" />
        )}
        <div className="text-xs sm:text-sm">
          {isDemoMode ? (
            <span>
              <strong className="font-semibold">Visual Preview (Demo Data):</strong> Displaying
              read-only sample {label} for layout inspection. Live Firestore records remain separate.
            </span>
          ) : (
            <span>
              <strong className="font-semibold">Live Firestore Database:</strong> Displaying real
              multi-tenant records
              {typeof liveCount === 'number' ? ` (${liveCount} ${label})` : ''}.
            </span>
          )}
        </div>
      </div>

      {onToggleDemo && (
        <button
          type="button"
          onClick={onToggleDemo}
          className="shrink-0 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors sm:self-auto whitespace-nowrap"
        >
          {isDemoMode ? 'Switch to Live Data' : 'Preview with Sample Data'}
        </button>
      )}
    </div>
  );
}
