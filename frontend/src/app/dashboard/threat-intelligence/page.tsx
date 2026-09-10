"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Radar, ShieldAlert, Database, History, CheckCircle2, Lock, ExternalLink, Filter } from 'lucide-react';
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-sm font-medium text-zinc-200 font-roboto shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span><strong className="text-white font-semibold">{findings.length}</strong> Intelligence Indicators</span>
            </div>
          </div>
        </div>

        {/* Data Provenance & Telemetry Integrity Banner */}
        <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Database className="w-4 h-4 text-zinc-400" />
            Verified Data Provenance & Ethical Sourcing
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            BreachGuard telemetry is derived exclusively from authorized public breach notifications (Have I Been Pwned), 
            security vendor reputation feeds (VirusTotal), and public network registries. 
            In compliance with zero-credential exposure standards, raw passwords and active session tokens are never persisted or returned.
          </p>
        </div>

        {/* Threat Intelligence Findings */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Intelligence Observations & Disclosures ({findings.length})
            </h2>
            <span className="text-[11px] text-zinc-500">Public Index Correlation</span>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {loading ? (
              <div className="py-8 text-center text-zinc-500 text-xs">Loading intelligence telemetry...</div>
            ) : findings.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No active threat intelligence matches detected for monitored domains.
              </div>
            ) : (
              findings.map((f) => (
                <div key={f.id} className="p-4 hover:bg-zinc-800/20 transition-colors space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
                        {f.severity}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {f.title}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {f.finding_id}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      Confidence: <strong className="text-zinc-200">{f.confidence.toUpperCase()}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {f.description}
                  </p>

                  <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/60 rounded-lg text-xs space-y-1">
                    <div className="text-[11px] text-zinc-500">
                      <strong className="text-zinc-400">Observed Evidence:</strong> {f.evidence}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      <strong className="text-zinc-400">Remediation:</strong> {f.recommended_remediation}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Masked Monitored Identities Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-zinc-400" />
              Corporate Identity Exposure History (Masked)
            </h2>
            <span className="text-[11px] text-zinc-500">Zero Raw Credential Storage</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800/60 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Masked Identity</th>
                  <th className="py-2.5 px-4">Breach / Incident</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Telemetry Type</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      Loading identity records...
                    </td>
                  </tr>
                ) : exposures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      No corporate identities currently observed in exposure telemetry.
                    </td>
                  </tr>
                ) : (
                  exposures.slice(0, 10).map((exp) => (
                    <tr key={exp.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-zinc-200">
                        {exp.email ? (exp.email.length > 5 ? `${exp.email[0]}***@${exp.email.split('@')[1] || 'domain'}` : exp.email) : 'identity@monitored.com'}
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        {exp.source}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          exp.severity === 'critical' ? 'text-red-400 bg-red-950/40 border border-red-800/40' :
                          exp.severity === 'high' ? 'text-orange-400 bg-orange-950/40 border border-orange-800/40' :
                          'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                        }`}>
                          {exp.severity?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-[11px]">
                        {exp.credentialType || 'Breach metadata'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-zinc-400">
                        {exp.status?.toUpperCase() || 'OPEN'}
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
