"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Radar, ShieldAlert, Database, History, CheckCircle2, Lock, ExternalLink, Filter, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';

export default function ThreatIntelligencePage() {
  const [findings, setFindings] = useState<any[]>([]);
  const [exposures, setExposures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [resFindings, resExposures] = await Promise.all([
          api.get('/findings?category=threat_intel'),
          api.get('/exposures')
        ]);
        setFindings(resFindings.data || []);
        setExposures(resExposures.data || []);
      } catch (err) {
        console.error('Failed to load threat intelligence data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono bg-rose-500/10 text-rose-300 border border-rose-500/35 shadow-[0_0_12px_rgba(244,63,94,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono bg-orange-500/10 text-orange-300 border border-orange-500/35 shadow-[0_0_12px_rgba(249,115,22,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono bg-amber-500/10 text-amber-300 border border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            MEDIUM
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider font-mono bg-zinc-900 text-zinc-400 border border-zinc-750">
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
              <Radar className="w-5 h-5 text-zinc-400" />
              Public Threat Intelligence & Breach Telemetry
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Cross-indexed public breach disclosures, security vendor reputation feeds, and historical compromised identities.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs font-medium text-blue-300 font-roboto shadow-[0_0_12px_rgba(59,130,246,0.12)]">
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
              <span><strong className="text-white font-semibold font-mono">{findings.length}</strong> Intelligence Indicators</span>
            </div>
          </div>
        </div>

        {/* Data Provenance & Telemetry Integrity Banner - Modernized */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/30 via-zinc-900/80 to-zinc-950 border border-blue-500/30 p-5 space-y-2 shadow-sm">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-400 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          <div className="flex items-center gap-2.5 text-xs font-semibold text-blue-300">
            <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Verified Data Provenance & Ethical Sourcing</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed font-roboto pl-8">
            BreachGuard telemetry is derived exclusively from authorized public breach notifications (Have I Been Pwned), 
            security vendor reputation feeds (VirusTotal), and public network registries. 
            In compliance with zero-credential exposure standards, raw passwords and active session tokens are never persisted or returned.
          </p>
        </div>

        {/* Threat Intelligence Findings */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Intelligence Observations & Disclosures ({findings.length})
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">Public Index Correlation</span>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {loading ? (
              <div className="py-10 text-center text-zinc-500 text-xs font-roboto">Loading intelligence telemetry...</div>
            ) : findings.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs font-roboto">
                No active threat intelligence matches detected for monitored domains.
              </div>
            ) : (
              findings.map((f) => (
                <div key={f.id} className="p-5 hover:bg-zinc-800/20 transition-colors space-y-2.5 font-roboto">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {getSeverityBadge(f.severity)}
                      <span className="text-sm font-semibold text-white tracking-tight">
                        {f.title}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        [{f.finding_id}]
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono">
                      Confidence: <strong className="text-zinc-200 uppercase font-semibold">{f.confidence}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-roboto">
                    {f.description}
                  </p>

                  <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl text-xs space-y-1.5 font-roboto">
                    <div className="text-xs text-zinc-400 font-roboto">
                      <strong className="text-zinc-200 font-medium">Observed Evidence:</strong>{' '}
                      <span className="text-zinc-300 font-mono text-[11px]">{f.evidence}</span>
                    </div>
                    {f.recommended_remediation && (
                      <div className="text-xs text-zinc-400 font-roboto">
                        <strong className="text-zinc-200 font-medium">Remediation:</strong>{' '}
                        <span className="text-zinc-300">{f.recommended_remediation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Masked Monitored Identities Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-zinc-400" />
              Corporate Identity Exposure History (Masked)
            </h2>
            <span className="text-xs text-zinc-400 font-roboto font-medium">Zero Raw Credential Storage</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-roboto">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/60 font-medium text-xs">
                <tr>
                  <th className="py-3 px-5">Masked Identity</th>
                  <th className="py-3 px-5">Breach / Incident</th>
                  <th className="py-3 px-5">Severity</th>
                  <th className="py-3 px-5">Telemetry Type</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300 font-roboto">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500 font-roboto">
                      Loading identity records...
                    </td>
                  </tr>
                ) : exposures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500 font-roboto">
                      No corporate identities currently observed in exposure telemetry.
                    </td>
                  </tr>
                ) : (
                  exposures.slice(0, 10).map((exp) => (
                    <tr key={exp.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-medium text-xs text-zinc-200">
                        {exp.email ? (exp.email.length > 5 ? `${exp.email[0]}***@${exp.email.split('@')[1] || 'domain'}` : exp.email) : 'identity@monitored.com'}
                      </td>
                      <td className="py-3.5 px-5 text-white font-medium text-sm">
                        {exp.source}
                      </td>
                      <td className="py-3.5 px-5">
                        {getSeverityBadge(exp.severity)}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-400 text-xs">
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono">
                          {exp.credentialType || 'Breach metadata'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-xs text-zinc-400 font-medium uppercase">
                        {exp.status || 'OPEN'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
