"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { Radar, ShieldAlert, Database, History, CheckCircle2, Lock, ExternalLink, Filter, ShieldCheck } from 'lucide-react';
import { useFindings, useExposures } from '@/hooks/useApi';
import { FindingListSkeleton } from '@/components/Skeletons';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatusBadge } from '@/components/StatusBadge';

export default function ThreatIntelligencePage() {
  const { data: findings = [], isLoading: findingsLoading } = useFindings({ category: 'threat_intel' });
  const { data: exposures = [], isLoading: exposuresLoading } = useExposures();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <Radar className="w-5 h-5 text-zinc-400" />
              Public Threat Intelligence &amp; Breach Telemetry
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Cross-indexed public breach disclosures, security vendor reputation feeds, and historical compromised identities.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-300 font-mono">
              <span><strong className="text-zinc-100 font-semibold">{findings.length}</strong> Indicators</span>
            </div>
          </div>
        </div>

        {/* Data Provenance & Telemetry Integrity Banner */}
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-4 space-y-2">
          <div className="flex items-center gap-2.5 text-xs font-medium text-zinc-200">
            <div className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span>Verified Data Provenance &amp; Ethical Sourcing</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed pl-6">
            BreachGuard telemetry is derived exclusively from authorized public breach notifications (Have I Been Pwned), 
            security vendor reputation feeds (VirusTotal), and public network registries. 
            In compliance with zero-credential exposure standards, raw passwords and active session tokens are never persisted or returned.
          </p>
        </div>

        {/* Threat Intelligence Findings */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between font-mono">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
              Intelligence Observations &amp; Disclosures ({findings.length})
            </h2>
            <span className="text-[11px] text-zinc-500">Public Index Correlation</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {findingsLoading && !findings.length ? (
              <FindingListSkeleton count={3} />
            ) : findings.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs font-mono">
                No active threat intelligence matches detected for monitored domains.
              </div>
            ) : (
              findings.map((f: any) => (
                <div key={f.id} className="p-4 hover:bg-zinc-850/40 transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-sm font-medium text-zinc-100 tracking-tight">
                        {f.title}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        [{f.finding_id}]
                      </span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      Confidence: <strong className="text-zinc-200 uppercase">{f.confidence}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {f.description}
                  </p>

                  <div className="p-2.5 bg-zinc-950/60 border border-zinc-800 rounded-md text-xs space-y-1 font-mono text-[11px]">
                    <div>
                      <span className="text-zinc-400 font-medium">Observed Evidence:</span>{' '}
                      <span className="text-zinc-300">{f.evidence}</span>
                    </div>
                    {f.recommended_remediation && (
                      <div>
                        <span className="text-zinc-400 font-medium">Remediation:</span>{' '}
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
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between font-mono">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              Corporate Identity Exposure History (Masked)
            </h2>
            <span className="text-xs text-zinc-500">Zero Raw Credential Storage</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 font-mono text-xs">
                <tr>
                  <th className="py-2.5 px-4">Masked Identity</th>
                  <th className="py-2.5 px-4">Breach / Incident</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Telemetry Type</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {exposuresLoading && !exposures.length ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-zinc-800 rounded w-28" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-zinc-800 rounded w-24" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-zinc-800 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-zinc-800 rounded w-20" /></td>
                      <td className="py-3 px-4 text-right"><div className="h-3.5 bg-zinc-800 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : exposures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500 font-mono">
                      No corporate identities currently observed in exposure telemetry.
                    </td>
                  </tr>
                ) : (
                  exposures.slice(0, 10).map((exp) => (
                    <tr key={exp.id} className="hover:bg-zinc-850/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-xs text-zinc-200">
                        {exp.email ? (exp.email.length > 5 ? `${exp.email[0]}***@${exp.email.split('@')[1] || 'domain'}` : exp.email) : 'identity@monitored.com'}
                      </td>
                      <td className="py-3 px-4 text-zinc-100 font-medium">
                        {exp.source}
                      </td>
                      <td className="py-3 px-4">
                        <SeverityBadge severity={exp.severity} />
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-xs">
                        <span className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10.5px] font-mono">
                          {exp.credentialType || 'Breach metadata'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <StatusBadge status={exp.status || 'open'} />
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
