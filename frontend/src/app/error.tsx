"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, RefreshCw, LayoutDashboard } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js caught client error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 bg-[#121214] border border-zinc-800 rounded-lg text-center space-y-4">
        <div className="w-10 h-10 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            Security Telemetry View Temporarily Interrupted
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The requested security dossier encountered a transient rendering error. Your data and continuous perimeter monitoring remain active and secure.
          </p>
        </div>

        {error?.message && (
          <div className="p-2.5 bg-[#0e0e10] border border-zinc-800 rounded text-left text-xs font-mono text-zinc-400 overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
