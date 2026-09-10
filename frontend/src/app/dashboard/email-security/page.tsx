"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { MailCheck, RefreshCw, ShieldCheck, AlertCircle, CheckCircle, Info, Lock, ArrowRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function EmailSecurityPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reAuditing, setReAuditing] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.get('/email-security');
      setAssessments(res.data || []);
    } catch (err) {
      console.error('Failed to load email security assessments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const active = assessments[0] || null;

  const handleReAudit = async () => {
    if (!active || !active.domain_id) return;
    setReAuditing(true);
    try {
      await api.post(`/email-security/scan/${active.domain_id}`);
      await loadData();
    } catch (err) {
      console.error('Re-audit failed', err);
    } finally {
      setReAuditing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pass':
        return <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded text-[10px] font-mono font-semibold">PASS</span>;
      case 'warning':
        return <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/60 text-amber-400 rounded text-[10px] font-mono font-semibold">WARNING</span>;
      case 'fail':
        return <span className="px-2 py-0.5 bg-red-950/60 border border-red-800/60 text-red-400 rounded text-[10px] font-mono font-semibold">FAIL</span>;
      default:
        return <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded text-[10px] font-mono">NOT DETECTED</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-zinc-400" />
              Email Security Posture
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              DNS anti-spoofing verification, DMARC enforcement monitoring, and transport encryption controls.
            </p>
          </div>
          <button
            onClick={handleReAudit}
            disabled={reAuditing || !active}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {reAuditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {reAuditing ? 'Auditing DNS...' : 'Re-Audit DNS Records'}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-500 text-xs">Loading email security posture...</div>
        ) : !active ? (
          <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800/60 rounded-xl">
            <p className="text-xs text-zinc-400">No email security assessment found. Run a domain scan from Monitored Domains to generate findings.</p>
          </div>
        ) : (
          <>
            {/* Scorecard Banner */}
            <div className="p-5 bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Assessed Domain: {active.domain}</span>
                <h2 className="text-base font-semibold text-white">Email Protection Index</h2>
                <p className="text-xs text-zinc-400 max-w-xl">
                  Evaluated across SPF authentication, DMARC alignment & enforcement, MX redundancy, and TLS transport integrity.
                </p>
              </div>

              <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
                <div className="text-center">
                  <div className="text-3xl font-bold font-mono text-white">
                    {active.score}
                    <span className="text-sm font-normal text-zinc-500"> / 100</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase text-zinc-400 mt-0.5">
                    {active.score >= 75 ? 'Strong Posture' : active.score >= 50 ? 'Moderate Protection' : 'Needs Enforcement'}
                  </div>
                </div>
              </div>
            </div>

            {/* Core Control Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* SPF */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">SPF (Sender Policy Framework)</span>
                  {getStatusBadge(active.spf?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {active.spf?.details || 'Validates sending server IP addresses against published domain policy.'}
                </p>
                {active.spf?.record && (
                  <div className="p-2 bg-zinc-950 border border-zinc-800/80 rounded text-[11px] font-mono text-zinc-300 break-all">
                    {active.spf.record}
                  </div>
                )}
              </div>

              {/* DMARC */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">DMARC Enforcement</span>
                  {getStatusBadge(active.dmarc?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {active.dmarc?.details || 'Policy instruction for receiving mail agents on spoofed messages.'}
                </p>
                {active.dmarc?.record && (
                  <div className="p-2 bg-zinc-950 border border-zinc-800/80 rounded text-[11px] font-mono text-zinc-300 break-all">
                    {active.dmarc.record}
                  </div>
                )}
              </div>

              {/* DKIM */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">DKIM Public Verification</span>
                  {getStatusBadge(active.dkim?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {active.dkim?.details || 'Cryptographic signature verification on outbound messages.'}
                </p>
                <div className="text-[11px] text-zinc-500 font-mono">
                  Audited common selectors (google, k1, default, s1)
                </div>
              </div>

              {/* MX */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Mail Exchange (MX) Routing</span>
                  {getStatusBadge(active.mx?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enterprise mail server routing verified.
                </p>
                {active.mx?.records && active.mx.records.length > 0 && (
                  <div className="text-[11px] font-mono text-zinc-400 space-y-0.5">
                    {active.mx.records.slice(0, 2).map((m: any, i: number) => (
                      <div key={i} className="truncate">Pref {m.preference}: {m.exchange}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* MTA-STS & TLS-RPT */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">MTA-STS & TLS-RPT</span>
                  {getStatusBadge(active.mta_sts?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Mandatory TLS transport enforcement and diagnostic reporting.
                </p>
                <div className="text-[11px] text-zinc-500">
                  MTA-STS: {active.mta_sts?.status} | TLS-RPT: {active.tls_rpt?.status}
                </div>
              </div>

              {/* DNSSEC */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">DNSSEC Security</span>
                  {getStatusBadge(active.dnssec?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Cryptographically signed DNS zone records against cache poisoning.
                </p>
                <div className="text-[11px] text-zinc-500 font-mono">
                  Zone status: {active.dnssec?.status}
                </div>
              </div>
            </div>

            {/* DMARC Remediation Guide */}
            {active.dmarc?.policy !== 'reject' && (
              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  Recommended DMARC Hardening Path
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your current policy is <code>p={active.dmarc?.policy || 'none'}</code>. To eliminate domain impersonation in executive wire fraud and phishing:
                </p>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 space-y-1">
                  <div>1. Review aggregate reports: <code>rua=mailto:dmarc-reports@{active.domain}</code></div>
                  <div>2. Align all corporate email sources (Google Workspace, Office 365, SendGrid).</div>
                  <div>3. Advance policy to quarantine: <code>v=DMARC1; p=quarantine; pct=100;</code></div>
                  <div>4. Advance policy to full rejection: <code>v=DMARC1; p=reject; pct=100;</code></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
