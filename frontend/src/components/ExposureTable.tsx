"use client";

import { Exposure } from '@/types';
import { formatDate } from '@/lib/utils';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge } from './StatusBadge';
import { Lock, ArrowUpRight, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface ExposureTableProps {
  data: Exposure[];
  onStatusChange?: (id: string, newStatus: 'open' | 'acknowledged' | 'remediated') => void;
  updatingId?: string | null;
}

export function ExposureTable({ data, onStatusChange, updatingId }: ExposureTableProps) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-left border-collapse min-w-[650px]">
        <thead>
          <tr className="border-b border-border-default text-2xs font-medium text-text-faint uppercase tracking-wider">
            <th className="pb-3 px-4">Identity / Account</th>
            <th className="pb-3 px-4">Breach Source</th>
            <th className="pb-3 px-4">Severity</th>
            <th className="pb-3 px-4">Credential Type</th>
            <th className="pb-3 px-4">First Detected</th>
            <th className="pb-3 px-4">Status</th>
            {onStatusChange && <th className="pb-3 px-4 text-right">Remediation</th>}
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-border-subtle">
          {data.map((exposure) => {
            const isLockedStealer = Boolean(exposure.upgradeRequired);

            return (
              <tr 
                key={exposure.id} 
                className={`transition-colors ${isLockedStealer ? 'bg-[#eab308]/[0.03] hover:bg-[#eab308]/[0.06]' : 'hover:bg-bg-hover'}`}
              >
                <td className="py-3.5 px-4">
                  <span className="text-text-primary font-mono text-xs font-medium">
                    {exposure.email}
                  </span>
                </td>

                <td className="py-3.5 px-4">
                  <div className="font-medium text-text-secondary font-sans text-xs">
                    {exposure.source}
                  </div>
                  {isLockedStealer && (
                    <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded bg-bg-inset border border-yellow-500/20 text-xs text-text-muted">
                      <Lock className="w-3 h-3 text-yellow-400 shrink-0" />
                      <span>Infostealer telemetry requires Business tier.</span>
                      <Link 
                        href="/settings" 
                        className="ml-1 text-yellow-400 hover:text-yellow-300 underline font-medium transition-colors inline-flex items-center gap-0.5"
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
                    <span className="font-mono text-xs text-text-faint tracking-wider">
                      •••••••••••••• (Redacted)
                    </span>
                  ) : (
                    <span className="text-text-muted font-mono text-xs">
                      {exposure.credentialType}
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 text-text-muted font-mono text-xs">
                  {formatDate(exposure.detectedAt)}
                </td>

                <td className="py-3.5 px-4">
                  <StatusBadge status={exposure.status} />
                </td>

                {onStatusChange && (
                  <td className="py-3.5 px-4 text-right">
                    {updatingId === exposure.id ? (
                      <span className="inline-flex items-center text-xs text-text-muted gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin text-text-secondary" />
                        Updating...
                      </span>
                    ) : exposure.status === 'open' ? (
                      <button
                        onClick={() => onStatusChange(exposure.id, 'remediated')}
                        className="text-xs font-medium text-text-faint hover:text-text-secondary transition-colors cursor-pointer"
                      >
                        Mark Remediated
                      </button>
                    ) : exposure.status === 'remediated' ? (
                      <button
                        onClick={() => onStatusChange(exposure.id, 'open')}
                        className="text-xs font-medium text-text-faint hover:text-text-secondary transition-colors cursor-pointer"
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => onStatusChange(exposure.id, 'remediated')}
                        className="text-xs font-medium text-text-faint hover:text-text-secondary transition-colors cursor-pointer"
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
              <td colSpan={onStatusChange ? 7 : 6} className="py-12 text-center">
                <div className="w-10 h-10 rounded-lg bg-bg-inset border border-border-default mx-auto flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5 text-text-faint" />
                </div>
                <h3 className="text-sm font-medium text-text-secondary">0 Active Exposures</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                  No compromised credentials found in active inventory.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}