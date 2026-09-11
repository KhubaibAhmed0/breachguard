"use client";

import { Exposure } from '@/types';
import { formatDate } from '@/lib/utils';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge } from './StatusBadge';
import { Lock, ArrowUpRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ExposureTableProps {
  data: Exposure[];
  onStatusChange?: (id: string, newStatus: 'open' | 'acknowledged' | 'remediated') => void;
  updatingId?: string | null;
}

export function ExposureTable({ data, onStatusChange, updatingId }: ExposureTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-800/80 text-[11px] font-medium text-zinc-500 uppercase tracking-wider font-roboto">
            <th className="pb-3 px-4">Identity / Account</th>
            <th className="pb-3 px-4">Breach Source</th>
            <th className="pb-3 px-4">Severity</th>
            <th className="pb-3 px-4">Credential Type</th>
            <th className="pb-3 px-4">First Detected</th>
            <th className="pb-3 px-4">Status</th>
            {onStatusChange && <th className="pb-3 px-4 text-right">Remediation</th>}
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-zinc-855 divide-zinc-900/60">
          {data.map((exposure) => {
            const isLockedStealer = Boolean(
              exposure.upgradeRequired ||
              (exposure.source && exposure.source.toLowerCase().includes('stealer') && exposure.status === 'open')
            );

            return (
              <tr 
                key={exposure.id} 
                className={`transition-colors ${isLockedStealer ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]' : 'hover:bg-zinc-900/40'}`}
              >
                <td className="py-3.5 px-4">
                  <span className="text-zinc-200 font-roboto text-[11px] font-medium">
                    {exposure.email}
                  </span>
                </td>

                <td className="py-3.5 px-4">
                  <div className="font-medium text-zinc-200">
                    {exposure.source}
                  </div>
                  {isLockedStealer && (
                    <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                      <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Infostealer botnet telemetry requires Business tier.</span>
                      <Link 
                        href="/settings" 
                        className="ml-1 text-amber-200 hover:text-white underline font-semibold transition-colors inline-flex items-center gap-0.5"
                      >
                        Upgrade to view <ArrowUpRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  )}
                </td>

                <td className="py-3.5 px-4">
                  <SeverityBadge severity={exposure.severity} />
                </td>

                <td className="py-3.5 px-4">
                  {isLockedStealer ? (
                    <span className="font-roboto text-[11px] text-zinc-500 tracking-wider">
                      •••••••••••••• (Redacted)
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-roboto text-[11px]">
                      {exposure.credentialType}
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 text-zinc-400 font-roboto text-[11px]">
                  {formatDate(exposure.detectedAt)}
                </td>

                <td className="py-3.5 px-4">
                  <StatusBadge status={exposure.status} />
                </td>

                {onStatusChange && (
                  <td className="py-3.5 px-4 text-right">
                    {updatingId === exposure.id ? (
                      <span className="inline-flex items-center text-[11px] text-zinc-400 gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin text-zinc-300" />
                        Updating...
                      </span>
                    ) : exposure.status === 'open' ? (
                      <button
                        onClick={() => onStatusChange(exposure.id, 'remediated')}
                        className="text-[11px] font-medium text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        Mark Remediated
                      </button>
                    ) : exposure.status === 'remediated' ? (
                      <button
                        onClick={() => onStatusChange(exposure.id, 'open')}
                        className="text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => onStatusChange(exposure.id, 'remediated')}
                        className="text-[11px] font-medium text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={onStatusChange ? 7 : 6} className="py-8 text-center text-zinc-500 text-xs">
                No active exposures found in current inventory.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}