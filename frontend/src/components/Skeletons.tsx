import React from 'react';

/**
 * Metric card skeleton matching StatsCard / Posture Card dimensions
 */
export function CardSkeleton({ count = 1, className = "" }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className={`p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 animate-pulse space-y-3.5 ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 bg-zinc-800/80 rounded-md" />
            <div className="h-8 w-8 bg-zinc-800/60 rounded-xl" />
          </div>
          <div className="h-8 w-16 bg-zinc-700/60 rounded-lg" />
          <div className="h-3 w-32 bg-zinc-800/60 rounded-md" />
        </div>
      ))}
    </>
  );
}

/**
 * Hero overall risk score card skeleton
 */
export function HeroCardSkeleton() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-zinc-900/50 border border-zinc-800/90 animate-pulse space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3.5 w-36 bg-zinc-800/80 rounded-md" />
          <div className="h-7 w-48 bg-zinc-700/70 rounded-lg" />
        </div>
        <div className="h-7 w-28 bg-zinc-800/60 rounded-full" />
      </div>
      <div className="h-10 w-24 bg-zinc-700/80 rounded-xl" />
      <div className="h-3.5 w-full max-w-md bg-zinc-800/60 rounded-md" />
    </div>
  );
}

/**
 * Table skeleton rows matching ExposureTable and DiscoveredAssets
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full divide-y divide-zinc-800/40 animate-pulse">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="py-4 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-8 w-8 bg-zinc-800/60 rounded-lg shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3.5 w-40 bg-zinc-800/80 rounded-md" />
              <div className="h-2.5 w-24 bg-zinc-850 rounded-md" />
            </div>
          </div>
          <div className="hidden sm:block h-3 w-28 bg-zinc-800/60 rounded-md" />
          <div className="h-5 w-16 bg-zinc-800/70 rounded-full" />
          <div className="hidden md:block h-3 w-20 bg-zinc-800/50 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Finding card list skeleton matching Attack Surface, Threat Intel, and Prioritized Findings
 */
export function FindingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-800/40 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="h-5 w-16 bg-zinc-800/80 rounded-full" />
              <div className="h-4 w-48 sm:w-64 bg-zinc-800/70 rounded-md" />
              <div className="h-3 w-16 bg-zinc-850 rounded-md" />
            </div>
            <div className="h-3 w-24 bg-zinc-800/50 rounded-md" />
          </div>
          <div className="h-3 w-full max-w-lg bg-zinc-850 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Domain grid skeleton matching 3-column perimeter cards
 */
export function DomainGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-750" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-zinc-800/80 rounded-md" />
                  <div className="h-3 w-20 bg-zinc-850 rounded-md" />
                </div>
              </div>
              <div className="h-4 w-16 bg-zinc-800/60 rounded-full" />
            </div>
            <div className="h-3 w-40 bg-zinc-850 rounded-md" />
          </div>
          <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between">
            <div className="h-7 w-20 bg-zinc-800/70 rounded-lg" />
            <div className="h-7 w-7 bg-zinc-800/50 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Report grid skeleton matching Audit & Compliance reports
 */
export function ReportGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-zinc-800/80 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 bg-zinc-800/80 rounded-md" />
                <div className="h-3 w-24 bg-zinc-850 rounded-md" />
              </div>
            </div>
            <div className="h-3 w-full bg-zinc-850 rounded-md" />
          </div>
          <div className="pt-4 border-t border-zinc-800/40 flex items-center justify-between">
            <div className="h-3.5 w-20 bg-zinc-800/60 rounded-md" />
            <div className="h-7 w-24 bg-zinc-800/80 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Chart container skeleton for timeline and donut visualizations
 */
export function ChartSkeleton({ height = "h-56", className = "" }: { height?: string; className?: string }) {
  return (
    <div className={`w-full ${height} bg-zinc-900/30 border border-zinc-800/60 rounded-xl animate-pulse flex flex-col justify-between p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-32 bg-zinc-800/80 rounded-md" />
        <div className="h-3 w-20 bg-zinc-850 rounded-md" />
      </div>
      <div className="flex items-end justify-between gap-3 h-28 pt-4 px-2">
        <div className="w-full h-12 bg-zinc-800/40 rounded-t-md" />
        <div className="w-full h-20 bg-zinc-800/50 rounded-t-md" />
        <div className="w-full h-16 bg-zinc-800/40 rounded-t-md" />
        <div className="w-full h-24 bg-zinc-800/60 rounded-t-md" />
        <div className="w-full h-14 bg-zinc-800/40 rounded-t-md" />
        <div className="w-full h-28 bg-zinc-700/60 rounded-t-md" />
      </div>
      <div className="h-2.5 w-full bg-zinc-850 rounded-full" />
    </div>
  );
}
