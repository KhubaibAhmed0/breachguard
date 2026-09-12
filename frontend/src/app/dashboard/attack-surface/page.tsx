"use client";

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Network, Search, ShieldAlert, CheckCircle2, Server, Globe, ExternalLink, Filter } from 'lucide-react';
import { useAttackSurfaceAssets, useAttackSurfaceFindings } from '@/hooks/useApi';
import { TableSkeleton, FindingListSkeleton } from '@/components/Skeletons';
import { SeverityBadge } from '@/components/SeverityBadge';

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

  const renderBadge = (severity: string) => {
    if (severity === 'clean' || severity === 'secure') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          SECURE
        </span>
      );
    }
    return <SeverityBadge severity={severity as any} />;
  };

  const isFiltered = severityFilter !== 'all' || searchTerm.trim().length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <Network className="w-5 h-5 text-zinc-400" />
              External Attack Surface
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Passive discovery of publicly observable subdomains, IP addresses, and listening network services.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span><strong className="text-zinc-100 font-semibold">{assets.length}</strong> Assets</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-300 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${allFindings.length > 0 ? 'bg-amber-400' : 'bg-zinc-500'}`} />
              <span><strong className="text-zinc-100 font-semibold">{allFindings.length}</strong> Findings</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter by hostname, IP, port, finding..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 px-3 py-1.5 focus:outline-none focus:border-zinc-700 cursor-pointer"
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
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors font-mono cursor-pointer"
                title="Reset all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Discovered Assets Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between font-mono">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              Discovered Hostnames & Network Perimeter ({filteredAssets.length}{filteredAssets.length !== assets.length ? ` of ${assets.length}` : ''})
            </h2>
            <span className="text-[11px] text-zinc-500">Source: Certificate Transparency & DNS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 font-mono text-xs">
                <tr>
                  <th className="py-2.5 px-4">Hostname</th>
                  <th className="py-2.5 px-4">Risk Status</th>
                  <th className="py-2.5 px-4">Resolved IP</th>
                  <th className="py-2.5 px-4">Open Ports</th>
                  <th className="py-2.5 px-4">Telemetry Source</th>
                  <th className="py-2.5 px-4 text-right">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {assetsLoading && !assets.length ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-4 w-40 bg-zinc-800/80 rounded" /></td>
                      <td className="py-3 px-4"><div className="h-4 w-20 bg-zinc-800/60 rounded" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-24 bg-zinc-800/60 rounded" /></td>
                      <td className="py-3 px-4"><div className="h-4 w-28 bg-zinc-800/50 rounded" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-20 bg-zinc-800/60 rounded" /></td>
                      <td className="py-3 px-4 text-right"><div className="h-3.5 w-16 bg-zinc-800/50 rounded ml-auto" /></td>
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
                            className="mt-2 px-3 py-1 text-xs font-mono text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors cursor-pointer"
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
                      <tr key={asset.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="py-3 px-4 text-zinc-100 font-mono text-xs">
                          {asset.hostname}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {renderBadge(assetSeverity)}
                            {assetFindings.length > 0 && (
                              <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
                                ({assetFindings.length})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-300 font-mono text-xs">
                          {asset.ip_address || <span className="text-zinc-600">Unresolved</span>}
                        </td>
                        <td className="py-3 px-4">
                          {asset.open_ports && asset.open_ports.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {asset.open_ports.map((p: number) => (
                                <span key={p} className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded text-[10.5px] font-mono">
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-xs font-mono">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 text-xs">
                          <span className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10.5px] font-mono text-zinc-400">
                            {asset.source}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-400 text-xs font-mono">
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
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between font-mono">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
              Perimeter Security Findings ({filteredFindings.length}{filteredFindings.length !== allFindings.length ? ` of ${allFindings.length}` : ''})
            </h2>
            <span className="text-[11px] text-zinc-500">Prioritized Technical Observations</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {findingsLoading && !allFindings.length ? (
              <FindingListSkeleton count={4} />
            ) : filteredFindings.length === 0 ? (
              <div className="py-12 text-center">
                <div className="flex flex-col items-center justify-center space-y-2">
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
                      className="mt-2 px-3 py-1 text-xs font-mono text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredFindings.map((finding: any) => (
                <div key={finding.id} className="p-4 hover:bg-zinc-850/40 transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderBadge(finding.severity)}
                      <span className="text-sm font-medium text-zinc-100 tracking-tight">
                        {finding.title}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        [{finding.finding_id}]
                      </span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      Asset: <strong className="text-zinc-200">{finding.asset}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {finding.description}
                  </p>

                  <div className="p-2.5 bg-zinc-950/60 border border-zinc-800 rounded-md text-xs space-y-1 font-mono text-[11px]">
                    <div>
                      <span className="text-zinc-400 font-medium">Observed Telemetry Evidence:</span>{' '}
                      <span className="text-zinc-300">{finding.evidence}</span>
                    </div>
                    {finding.recommended_remediation && (
                      <div>
                        <span className="text-zinc-400 font-medium">Recommended Remediation:</span>{' '}
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
