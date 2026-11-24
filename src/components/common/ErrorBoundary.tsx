import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h1 className="font-display text-xl font-bold text-slate-900">
                Application Error Encountered
              </h1>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A component error interrupted the current view. You can reload the application or
              return to the home workspace.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 break-words">
              {this.state.message}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E40AF] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </button>
              <a
                href="/"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
