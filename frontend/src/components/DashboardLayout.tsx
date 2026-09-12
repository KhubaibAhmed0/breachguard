"use client";

import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Clock, ArrowRight, X, Menu, Shield } from 'lucide-react';
import Link from 'next/link';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isTrial = Boolean(user?.isTrial && !user?.plan?.toLowerCase().includes('enterprise'));
  const daysRemaining = user?.trialDaysRemaining ?? 7;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden selection:bg-zinc-800">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex w-64 h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />
          {/* Sliding drawer */}
          <div className="relative w-72 max-w-[85vw] h-full bg-zinc-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
            <Sidebar isMobile onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-zinc-950/90 border-b border-zinc-900 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-zinc-100" />
              </div>
              <span className="font-semibold text-sm text-white tracking-tight">BreachGuard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10.5px] font-mono capitalize">
              {user?.plan || 'Business'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-zinc-950 p-3.5 sm:p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
            {isTrial && !bannerDismissed && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 py-2.5 bg-zinc-900/70 border border-zinc-800 rounded-lg">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <Clock className="w-3.5 h-3.5 text-zinc-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">7-Day Business Trial Active</span>
                      <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Continuous threat monitoring, up to 25 privileged identities, and infostealer telemetry.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-zinc-800/60 sm:border-0">
                  <Link
                    href="/settings"
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Upgrade Plan <ArrowRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
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
    </div>
  );
}