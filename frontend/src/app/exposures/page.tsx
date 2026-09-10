"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { ExposureTable } from '@/components/ExposureTable';
import { useExposures, useUpdateExposureStatus } from '@/hooks/useApi';
import { Search, Loader2, Lock, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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
            Complete inventory of compromised credentials, session tokens, and breach records.
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
        <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-zinc-900/80 to-zinc-900 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="flex items-center gap-2.5 text-amber-300">
            <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-300">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white">Infostealer botnet telemetry requires Business tier: </span>
              <span className="text-zinc-300">
                RedLine, LummaC2, and Vidar session tokens, browser cookies, and device fingerprints are locked.
              </span>
            </div>
          </div>
          <Link
            href="/settings"
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shrink-0"
          >
            <span>Upgrade to view</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 sm:p-4">
        {isLoading ? (
          <div className="py-12 flex justify-center items-center text-zinc-500 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading threat inventory...
          </div>
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