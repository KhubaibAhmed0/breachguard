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
  const { data: allFindings = [], isLoading: findingsLoading } = useAttackSurfaceFindings();

  const loading = assetsLoading || findingsLoading;

  // Correlate finding records with asset hostnames or IPs
  const getAssetFindings = (asset: any) => {
    const host = (asset.hostname || '').toLowerCase().trim();
    const ip = (asset.ip_address || '').trim();
    return allFindings.filter((f: any) => {
      if (!f.asset) return false;
      const fAsset = f.asset.toLowerCase().trim();
      if (fAsset === host) return true;
      if (fAsset.startsWith(`${host}:`) || fAsset.startsWith(`${host} `) || fAsset.startsWith(`${host}/`)) return true;
      if (ip && fAsset.includes(ip)) return true;
      return false;
    });
  };

  // Determine overall asset severity from its associated findings and exposed services
  const getAssetSeverity = (asset: any, assetFindings: any[]) => {
    if (assetFindings.length > 0) {
      if (assetFindings.some((f: any) => f.severity?.toLowerCase() === 'critical')) return 'critical';
      if (assetFindings.some((f: any) => f.severity?.toLowerCase() === 'high')) return 'high';
      if (assetFindings.some((f: any) => f.severity?.toLowerCase() === 'medium')) return 'medium';
      if (assetFindings.some((f: any) => f.severity?.toLowerCase() === 'low')) return 'low';
    }

    // Direct port inspection for unhedged administrative protocols
    const ports: number[] = Array.isArray(asset.open_ports) ? asset.open_ports : [];
    if (ports.includes(23) || ports.includes(6379)) return 'critical';
    if (ports.some((p: number) => [22, 3389, 3306, 5432, 27017, 5900].includes(p))) return 'high';
    if (ports.includes(21)) return 'medium';
    if (ports.some((p: number) => [8080, 8443].includes(p))) return 'low';
    if (asset.vulns && asset.vulns.length > 0) return 'medium';

    return 'clean';
  };

  const filteredAssets = assets.filter((a: any) => {
    const assetFindings = getAssetFindings(a);
    const assetSeverity = getAssetSeverity(a, assetFindings);

    // Severity filtering
    if (severityFilter === 'clean') {
      if (assetSeverity !== 'clean') return false;
    } else if (severityFilter !== 'all') {
      const matchesFilter =
        assetSeverity === severityFilter ||
        assetFindings.some((f: any) => f.severity?.toLowerCase() === severityFilter.toLowerCase());
      if (!matchesFilter) return false;
    }

    // Search filtering
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        (a.hostname && a.hostname.toLowerCase().includes(term)) ||
        (a.ip_address && a.ip_address.includes(term)) ||
        (a.source && a.source.toLowerCase().includes(term)) ||
        (Array.isArray(a.open_ports) && a.open_ports.some((p: any) => String(p).includes(term))) ||
        assetFindings.some((f: any) =>
          (f.title && f.title.toLowerCase().includes(term)) ||
          (f.description && f.description.toLowerCase().includes(term))
        );
      if (!matchesSearch) return false;
    }

    return true;
  });

  const filteredFindings = allFindings.filter((f: any) => {
    if (severityFilter === 'clean') return false;
    if (severityFilter !== 'all' && f.severity?.toLowerCase() !== severityFilter.toLowerCase()) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (f.title && f.title.toLowerCase().includes(term)) ||
      (f.asset && f.asset.toLowerCase().includes(term)) ||
      (f.description && f.description.toLowerCase().includes(term)) ||
      (f.evidence && f.evidence.toLowerCase().includes(term)) ||
      (f.finding_id && f.finding_id.toLowerCase().includes(term))
    );
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.14)]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            LOW
          </span>
        );
      case 'clean':
      case 'secure':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider font-roboto bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SECURE
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

  const isFiltered = severityFilter !== 'all' || searchTerm.trim().length > 0;

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
              <span className={`w-2 h-2 rounded-full ${allFindings.length > 0 ? 'bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(251,113,133,0.8)]' : 'bg-zinc-500'}`} />
              <span><strong className="text-rose-200 font-semibold font-roboto">{allFindings.length}</strong> Active Findings</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter by hostname, IP, port, finding..."
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
              <option value="clean">Secure / Clean Only</option>
            </select>
            {isFiltered && (
              <button
                onClick={() => { setSeverityFilter('all'); setSearchTerm(''); }}
                className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl transition-colors font-roboto"
                title="Reset all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Discovered Assets Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-400" />
              Discovered Hostnames & Network Perimeter ({filteredAssets.length}{filteredAssets.length !== assets.length ? ` of ${assets.length}` : ''})
            </h2>
            <span className="text-[11px] font-roboto text-zinc-500">Source: Certificate Transparency & DNS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-roboto">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/60 font-medium text-xs">
                <tr>
                  <th className="py-3 px-5">Hostname</th>
                  <th className="py-3 px-5">Risk Status</th>
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
                      <td className="py-4 px-5"><div className="h-4 w-20 bg-zinc-800/60 rounded" /></td>
                      <td className="py-4 px-5"><div className="h-3.5 w-24 bg-zinc-800/60 rounded" /></td>
                      <td className="py-4 px-5"><div className="h-4 w-28 bg-zinc-800/50 rounded" /></td>
                      <td className="py-4 px-5"><div className="h-3.5 w-20 bg-zinc-800/60 rounded" /></td>
                      <td className="py-4 px-5 text-right"><div className="h-3.5 w-16 bg-zinc-800/50 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <ShieldAlert className="w-8 h-8 text-zinc-600 mb-1" />
                        <p className="text-sm font-medium text-zinc-300">
                          No {severityFilter !== 'all' ? `"${severityFilter.toUpperCase()}" ` : ''}assets found
                        </p>
                        <p className="text-xs text-zinc-500 max-w-sm">
                          {severityFilter !== 'all'
                            ? `No discovered perimeter assets currently match the "${severityFilter}" filter.`
                            : 'No perimeter assets match your search criteria.'}
                        </p>
                        {isFiltered && (
                          <button 
                            onClick={() => { setSeverityFilter('all'); setSearchTerm(''); }}
                            className="mt-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors font-roboto"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset: any) => {
                    const assetFindings = getAssetFindings(asset);
                    const assetSeverity = getAssetSeverity(asset, assetFindings);

                    return (
                      <tr key={asset.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-5 text-white font-medium text-sm font-roboto">
                          {asset.hostname}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(assetSeverity)}
                            {assetFindings.length > 0 && (
                              <span className="text-[11px] font-roboto text-zinc-400 hidden sm:inline">
                                ({assetFindings.length} issue{assetFindings.length > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
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
                    );
                  })
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
              Perimeter Security Findings ({filteredFindings.length}{filteredFindings.length !== allFindings.length ? ` of ${allFindings.length}` : ''})
            </h2>
            <span className="text-[11px] font-roboto text-zinc-500">Prioritized Technical Observations</span>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {findingsLoading && !allFindings.length ? (
              <FindingListSkeleton count={4} />
            ) : filteredFindings.length === 0 ? (
              <div className="py-12 text-center">
                <div className="flex flex-col items-center justify-center space-y-2 font-roboto">
                  <CheckCircle2 className="w-8 h-8 text-zinc-600 mb-1" />
                  <p className="text-sm font-medium text-zinc-300">
                    No {severityFilter !== 'all' ? `"${severityFilter.toUpperCase()}" ` : ''}findings detected
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    {severityFilter !== 'all'
                      ? `No attack surface findings with "${severityFilter}" severity are currently affecting your perimeter.`
                      : 'Zero attack surface security findings detected across monitored perimeter.'}
                  </p>
                  {isFiltered && (
                    <button 
                      onClick={() => { setSeverityFilter('all'); setSearchTerm(''); }}
                      className="mt-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors font-roboto"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
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
