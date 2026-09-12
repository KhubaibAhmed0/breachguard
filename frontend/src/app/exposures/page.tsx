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
    const matchesSeverity = severityFilter === 'all' || e.severity?.toLowerCase() === severityFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || e.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const hasLockedStealer = Boolean(filteredExposures?.some(e => e.upgradeRequired));

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Threat Exposures</h1>
          <p className="text-xs text-zinc-400 mt-1">
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
              className="w-full pl-9 pr-3 py-1.5 bg-[#121214] border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#121214] border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
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
            className="px-2.5 py-1.5 bg-[#121214] border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
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
        <div className="mb-6 p-4 rounded-lg bg-[#141416] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-zinc-200 text-xs">Infostealer Botnet Telemetry Requires Business Tier</span>
                <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Feature Gated
                </span>
              </div>
              <p className="text-zinc-400 mt-1 text-xs leading-relaxed">
                RedLine, LummaC2, and Vidar botnet logs, exfiltrated credentials, and threat forensic details are encrypted and locked under your current plan.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>Upgrade Plan</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="bg-[#121214] border border-zinc-800 rounded-lg p-3 sm:p-4">
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