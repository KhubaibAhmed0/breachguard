"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { ExposureTable } from '@/components/ExposureTable';
import { useExposures, useUpdateExposureStatus } from '@/hooks/useApi';
import { Search, Loader2, Lock, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { TableSkeleton } from '@/components/Skeletons';

export default function ExposuresPage() {
  const { data: exposures, isLoading } = useExposures();
  const updateStatusMutation = useUpdateExposureStatus();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredExposures = exposures?.filter(e => {
    const matchesSearch = 
      e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || e.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const hasLockedStealer = filteredExposures?.some(
    e => e.upgradeRequired || (e.source && e.source.toLowerCase().includes('stealer'))
  );

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatus: 'open' | 'acknowledged' | 'remediated') => {
    try {
      setUpdatingId(id);
      await updateStatusMutation.mutateAsync({ id, status: newStatus });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Threat Exposures</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Complete inventory of compromised credentials, infostealer detections, and breach records.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter by email, breach name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="remediated">Remediated</option>
          </select>
        </div>
      </div>

      {/* Infostealer Tier Gating Notice Banner */}
      {hasLockedStealer && (
        <div className="relative overflow-hidden mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-zinc-900/90 to-zinc-950 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs animate-fadeIn shadow-[0_0_24px_rgba(245,158,11,0.08)]">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
          <div className="flex items-center gap-3 text-amber-300">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white tracking-tight text-sm">Infostealer Botnet Telemetry Requires Business Tier</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-roboto font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Feature Gated
                </span>
              </div>
              <p className="text-zinc-300 mt-0.5 text-xs font-roboto leading-relaxed">
                RedLine, LummaC2, and Vidar botnet logs, exfiltrated credentials, and threat forensic details are encrypted and locked under your current plan.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md"
          >
            <span>Upgrade to View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 sm:p-4">
        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <ExposureTable 
            data={filteredExposures || []} 
            onStatusChange={handleStatusChange}
            updatingId={updatingId}
          />
        )}
      </div>
    </DashboardLayout>
  );
}