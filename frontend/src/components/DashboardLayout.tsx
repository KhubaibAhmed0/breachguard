"use client";

import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Clock, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isTrial = user?.isTrial ?? false;
  const daysRemaining = user?.trialDaysRemaining ?? 7;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden selection:bg-zinc-800">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950 p-6 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {isTrial && !bannerDismissed && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gradient-to-r from-emerald-950/40 via-zinc-900/70 to-cyan-950/40 border border-emerald-500/20 rounded-xl shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">7-Day Business Trial Active</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    You have full access to continuous threat monitoring, up to 25 privileged identities, and infostealer telemetry.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/settings"
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                >
                  Upgrade Plan <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                  title="Dismiss banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}