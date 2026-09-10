"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Network, Search, ShieldAlert, CheckCircle2, Server, Globe, ExternalLink, Filter } from 'lucide-react';
import api from '@/lib/api';

export default function AttackSurfacePage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    async function loadData() {
      try {
        const [resAssets, resFindings] = await Promise.all([
          api.get('/attack-surface/assets'),
          api.get('/attack-surface/findings')
        ]);
        setAssets(resAssets.data || []);
        setFindings(resFindings.data || []);
      } catch (err) {
        console.error('Failed to load attack surface data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredAssets = assets.filter(a => 
    a.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.ip_address && a.ip_address.includes(searchTerm))
  );

  const filteredFindings = findings.filter(f => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    return f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           f.asset.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-sm font-medium text-zinc-200 font-roboto shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span><strong className="text-white font-semibold">{assets.length}</strong> Assets Discovered</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-red-950/40 border border-red-800/60 text-red-300 rounded-lg text-sm font-medium font-roboto shadow-sm">
              <span className={`w-2 h-2 rounded-full ${findings.length > 0 ? 'bg-red-400 animate-pulse' : 'bg-zinc-500'}`} />
              <span><strong className="text-red-200 font-semibold">{findings.length}</strong> Findings Active</span>
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
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-300 px-2.5 py-1.5 focus:outline-none focus:border-zinc-700"
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
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-400" />
              Discovered Hostnames & Network Perimeter
            </h2>
            <span className="text-[11px] text-zinc-500">Source: Certificate Transparency & DNS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800/60 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Hostname</th>
                  <th className="py-2.5 px-4">Resolved IP</th>
                  <th className="py-2.5 px-4">Open Ports</th>
                  <th className="py-2.5 px-4">Telemetry Source</th>
                  <th className="py-2.5 px-4 text-right">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      Enumerating external attack surface...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      No assets found matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-zinc-100 font-medium">
                        {asset.hostname}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {asset.ip_address || <span className="text-zinc-600">Unresolved</span>}
                      </td>
                      <td className="py-3 px-4">
                        {asset.open_ports && asset.open_ports.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {asset.open_ports.map((p: number) => (
                              <span key={p} className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] font-mono">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">None open</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-[11px]">
                        {asset.source}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-500 text-[11px] font-mono">
                        {asset.last_seen_at ? new Date(asset.last_seen_at).toLocaleDateString() : 'Active'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attack Surface Findings */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Perimeter Security Findings ({filteredFindings.length})
            </h2>
            <span className="text-[11px] text-zinc-500">Prioritized Technical Observations</span>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {loading ? (
              <div className="py-8 text-center text-zinc-500 text-xs">Loading findings...</div>
            ) : filteredFindings.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No active attack surface findings detected.
              </div>
            ) : (
              filteredFindings.map((finding) => {
                const sevColor = 
                  finding.severity === 'critical' ? 'bg-red-950/60 text-red-400 border-red-800/60' :
                  finding.severity === 'high' ? 'bg-orange-950/60 text-orange-400 border-orange-800/60' :
                  finding.severity === 'medium' ? 'bg-amber-950/60 text-amber-400 border-amber-800/60' :
                  'bg-zinc-800 text-zinc-400 border-zinc-700';

                return (
                  <div key={finding.id} className="p-4 hover:bg-zinc-800/20 transition-colors space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-roboto uppercase font-semibold border ${sevColor}`}>
                          {finding.severity}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {finding.title}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {finding.finding_id}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Asset: <code className="text-zinc-200">{finding.asset}</code>
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {finding.description}
                    </p>

                    <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/60 rounded-lg text-xs space-y-1">
                      <div className="text-[11px] text-zinc-500">
                        <strong className="text-zinc-400">Observed Evidence:</strong> {finding.evidence}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        <strong className="text-zinc-400">Remediation:</strong> {finding.recommended_remediation}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
