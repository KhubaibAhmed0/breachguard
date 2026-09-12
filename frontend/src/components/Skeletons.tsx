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
          className={`p-4 rounded-lg bg-bg-surface border border-border-default animate-pulse space-y-3 ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 bg-border-strong rounded" />
            <div className="h-6 w-6 bg-border-default rounded" />
          </div>
          <div className="h-7 w-16 bg-border-strong rounded" />
          <div className="h-3 w-32 bg-border-default rounded" />
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
    <div className="p-5 rounded-lg bg-bg-surface border border-border-default animate-pulse space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3.5 w-36 bg-border-strong rounded" />
          <div className="h-7 w-48 bg-border-strong rounded" />
        </div>
        <div className="h-6 w-24 bg-border-default rounded" />
      </div>
      <div className="h-9 w-24 bg-border-strong rounded" />
      <div className="h-3 w-full max-w-md bg-border-default rounded" />
    </div>
  );
}

/**
 * Table skeleton rows matching ExposureTable and DiscoveredAssets
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full divide-y divide-border-subtle animate-pulse">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="py-3 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-7 w-7 bg-border-default rounded shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3.5 w-40 bg-border-strong rounded" />
              <div className="h-2.5 w-24 bg-bg-inset rounded" />
            </div>
          </div>
          <div className="hidden sm:block h-3 w-28 bg-border-default rounded" />
          <div className="h-5 w-16 bg-border-strong rounded" />
          <div className="hidden md:block h-3 w-20 bg-border-default rounded" />
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
    <div className="divide-y divide-border-subtle animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="h-5 w-16 bg-border-strong rounded" />
              <div className="h-4 w-48 sm:w-64 bg-border-strong rounded" />
              <div className="h-3 w-16 bg-bg-inset rounded" />
            </div>
            <div className="h-3 w-24 bg-border-default rounded" />
          </div>
          <div className="h-3 w-full max-w-lg bg-bg-inset rounded" />
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
        <div key={idx} className="bg-bg-surface border border-border-default rounded-lg p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-border-strong border border-border-default" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-border-strong rounded" />
                  <div className="h-3 w-20 bg-bg-inset rounded" />
                </div>
              </div>
              <div className="h-4 w-16 bg-border-default rounded" />
            </div>
            <div className="h-3 w-40 bg-bg-inset rounded" />
          </div>
          <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
            <div className="h-6 w-20 bg-border-strong rounded" />
            <div className="h-6 w-6 bg-border-default rounded" />
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
        <div key={idx} className="bg-bg-surface border border-border-default rounded-lg p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-border-strong rounded shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 bg-border-strong rounded" />
                <div className="h-3 w-24 bg-bg-inset rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-bg-inset rounded" />
          </div>
          <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
            <div className="h-3.5 w-20 bg-border-default rounded" />
            <div className="h-6 w-24 bg-border-strong rounded" />
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
    <div className={`w-full ${height} bg-bg-surface border border-border-default rounded-lg animate-pulse flex flex-col justify-between p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-32 bg-border-strong rounded" />
        <div className="h-3 w-20 bg-bg-inset rounded" />
      </div>
      <div className="flex items-end justify-between gap-3 h-28 pt-4 px-2">
        <div className="w-full h-12 bg-border-subtle rounded-t" />
        <div className="w-full h-20 bg-border-default rounded-t" />
        <div className="w-full h-16 bg-border-subtle rounded-t" />
        <div className="w-full h-24 bg-border-strong rounded-t" />
        <div className="w-full h-14 bg-border-subtle rounded-t" />
        <div className="w-full h-28 bg-border-strong rounded-t" />
      </div>
      <div className="h-2 w-full bg-bg-inset rounded" />
    </div>
  );
}

