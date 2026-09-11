"use client";

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Network, Search, ShieldAlert, CheckCircle2, Server, Globe, ExternalLink, Filter } from 'lucide-react';
import { useAttackSurfaceAssets, useAttackSurfaceFindings } from '@/hooks/useApi';
import { TableSkeleton, FindingListSkeleton } from '@/components/Skeletons';

export default function AttackSurfacePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const { data: assets = [], isLoading: assetsLoading } = useAttackSurfaceAssets();
  const { data: findings = [], isLoading: findingsLoading } = useAttackSurfaceFindings({ severity: severityFilter });

  const loading = assetsLoading || findingsLoading;

  const filteredAssets = assets.filter((a: any) => 
    a.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.ip_address && a.ip_address.includes(searchTerm))
  );

  const filteredFindings = findings.filter((f: any) => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    return f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           f.asset.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-rose-500/10 text-rose-300 border border-rose-500/35 shadow-[0_0_12px_rgba(244,63,94,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-orange-500/10 text-orange-300 border border-orange-500/35 shadow-[0_0_12px_rgba(249,115,22,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-amber-500/10 text-amber-300 border border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            MEDIUM
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider font-roboto bg-zinc-900 text-zinc-400 border border-zinc-750">
            INFO
          </span>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Network className="w-5 h-5 text-zinc-400" />
              External Attack Surface
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Passive discovery of publicly observable subdomains, IP addresses, and listening network services.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 border border-zinc-750 rounded-xl text-xs font-medium text-zinc-200 font-roboto shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span><strong className="text-white font-semibold font-roboto">{assets.length}</strong> Discovered Assets</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-medium font-roboto shadow-[0_0_12px_rgba(244,63,94,0.12)]">
              <span className={`w-2 h-2 rounded-full ${findings.length > 0 ? 'bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(251,113,133,0.8)]' : 'bg-zinc-500'}`} />
              <span><strong className="text-rose-200 font-semibold font-roboto">{findings.length}</strong> Active Findings</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter by hostname, IP, port..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-300 px-3 py-2 focus:outline-none focus:border-zinc-700 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>
        </div>

        {/* Discovered Assets Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-400" />
              Discovered Hostnames & Network Perimeter
            </h2>
            <span className="text-[11px] font-roboto text-zinc-500">Source: Certificate Transparency & DNS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-roboto">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/60 font-medium text-xs">
                <tr>
                  <th className="py-3 px-5">Hostname</th>
                  <th className="py-3 px-5">Resolved IP</th>
                  <th className="py-3 px-5">Open Ports</th>
                  <th className="py-3 px-5">Telemetry Source</th>
                  <th className="py-3 px-5 text-right">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {assetsLoading && !assets.length ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-5"><div className="h-4 w-40 bg-zinc-800/80 rounded" /></td>
                      <td className="py-4 px-5"><div className="h-3.5 w-24 bg-zinc-800/60 rounded" /></td>
                      <td className="py-4 px-5"><div className="h-4 w-28 bg-zinc-800/50 rounded" /></td>
                      <td className="py-4 px-5"><div className="h-3.5 w-20 bg-zinc-800/60 rounded" /></td>
                      <td className="py-4 px-5 text-right"><div className="h-3.5 w-16 bg-zinc-800/50 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500">
                      No assets found matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset: any) => (
                    <tr key={asset.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-5 text-white font-medium text-sm font-roboto">
                        {asset.hostname}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-300 font-roboto text-xs">
                        {asset.ip_address || <span className="text-zinc-600">Unresolved</span>}
                      </td>
                      <td className="py-3.5 px-5">
                        {asset.open_ports && asset.open_ports.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {asset.open_ports.map((p: number) => (
                              <span key={p} className="px-2 py-0.5 bg-zinc-900 border border-zinc-700/80 text-zinc-200 rounded-md text-[11px] font-roboto font-medium">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">None open</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-400 text-xs">
                        <span className="px-2 py-0.5 bg-zinc-900/80 border border-zinc-800 rounded-md text-[11px]">
                          {asset.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-zinc-400 text-xs font-roboto">
                        {asset.last_seen_at ? new Date(asset.last_seen_at).toLocaleDateString() : 'Active'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Perimeter Findings List */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Perimeter Security Findings ({filteredFindings.length})
            </h2>
            <span className="text-[11px] font-roboto text-zinc-500">Prioritized Technical Observations</span>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {findingsLoading && !findings.length ? (
              <FindingListSkeleton count={4} />
            ) : filteredFindings.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs">
                No active attack surface findings detected across monitored perimeter.
              </div>
            ) : (
              filteredFindings.map((finding: any) => (
                <div key={finding.id} className="p-5 hover:bg-zinc-800/20 transition-colors space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {getSeverityBadge(finding.severity)}
                      <span className="text-sm font-semibold text-white tracking-tight">
                        {finding.title}
                      </span>
                      <span className="text-[11px] font-roboto text-zinc-500">
                        [{finding.finding_id}]
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 font-roboto">
                      Asset: <strong className="text-zinc-200">{finding.asset}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-roboto">
                    {finding.description}
                  </p>

                  <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl text-xs space-y-1.5 font-roboto">
                    <div className="text-xs text-zinc-400 font-roboto">
                      <strong className="text-zinc-200 font-medium">Observed Telemetry Evidence:</strong>{' '}
                      <span className="text-zinc-300 font-roboto text-[11px]">{finding.evidence}</span>
                    </div>
                    {finding.recommended_remediation && (
                      <div className="text-xs text-zinc-400 font-roboto">
                        <strong className="text-zinc-200 font-medium">Recommended Remediation:</strong>{' '}
                        <span className="text-zinc-300">{finding.recommended_remediation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
