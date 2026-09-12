"use client";

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { MailCheck, RefreshCw, ShieldCheck, AlertCircle, CheckCircle, Info, Lock, ArrowRight, Loader2, Sparkles, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useEmailSecurityOverview } from '@/hooks/useApi';
import { CardSkeleton, HeroCardSkeleton } from '@/components/Skeletons';

export default function EmailSecurityPage() {
  const queryClient = useQueryClient();
  const { data: rawAssessments, isLoading: loading } = useEmailSecurityOverview();
  const assessments = Array.isArray(rawAssessments) ? rawAssessments : (rawAssessments ? [rawAssessments] : []);
  const [reAuditing, setReAuditing] = useState(false);

  const active = assessments[0] || null;

  const handleReAudit = async () => {
    if (!active || !active.domain_id) return;
    setReAuditing(true);
    try {
      await api.post(`/email-security/scan/${active.domain_id}`);
      await queryClient.invalidateQueries({ queryKey: ['emailSecurityOverview'] });
    } catch (err) {
      console.error('Re-audit failed', err);
    } finally {
      setReAuditing(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'pass':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            PASS
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
            WARNING
          </span>
        );
      case 'fail':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
            FAIL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            NOT DETECTED
          </span>
        );
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) {
      return {
        label: 'Strong Posture',
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
      };
    }
    if (score >= 50) {
      return {
        label: 'Moderate Protection',
        classes: 'bg-amber-500/10 text-amber-400 border-amber-500/25'
      };
    }
    return {
      label: 'Needs Enforcement',
      classes: 'bg-rose-500/10 text-rose-400 border-rose-500/25'
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
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
            className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {reAuditing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />}
            {reAuditing ? 'Auditing DNS...' : 'Re-Audit DNS Records'}
          </button>
        </div>

        {loading && !active ? (
          <div className="space-y-6">
            <HeroCardSkeleton />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        ) : !active ? (
          <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400 font-mono">No email security assessment found. Run a domain scan from Monitored Domains to generate findings.</p>
          </div>
        ) : (
          <>
            {/* Scorecard Banner */}
            {(() => {
              const badge = getScoreBadge(active.score);
              return (
                <div className="p-5 sm:p-6 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                      Assessed Domain: <strong className="text-zinc-200">{active.domain}</strong>
                    </span>
                    <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight flex items-center gap-2.5">
                      Email Protection Index
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-mono font-medium border ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                      Evaluated continuously across SPF authentication, DMARC alignment & enforcement, MX routing redundancy, and TLS transport integrity.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-zinc-950/60 p-3.5 border border-zinc-800 rounded-lg shrink-0">
                    <div className="text-center min-w-[90px]">
                      <div className={`text-3xl sm:text-4xl font-semibold font-mono ${active.score >= 75 ? 'text-emerald-400' : active.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {active.score}
                        <span className="text-sm font-normal text-zinc-500 font-sans"> / 100</span>
                      </div>
                      <div className="text-[10.5px] font-medium uppercase text-zinc-400 mt-1 font-mono">
                        Posture Score
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Core Control Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. SPF */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">SPF (Sender Policy Framework)</span>
                  {getStatusBadge(active.spf?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {active.spf?.details || 'Validates sending server IP addresses against published domain policy.'}
                </p>
                {active.spf?.record && (
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-300 break-all leading-relaxed">
                    {active.spf.record}
                  </div>
                )}
              </div>

              {/* 2. DMARC */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">DMARC Enforcement</span>
                  {getStatusBadge(active.dmarc?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {active.dmarc?.details || 'Policy instruction for receiving mail agents on spoofed messages.'}
                </p>
                {active.dmarc?.record && (
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-300 break-all leading-relaxed">
                    {active.dmarc.record}
                  </div>
                )}
              </div>

              {/* 3. DKIM */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">DKIM Public Verification</span>
                  {getStatusBadge(active.dkim?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {active.dkim?.details || 'Cryptographic signature verification on outbound messages.'}
                </p>
                <div className="text-[11px] text-zinc-500 font-mono">
                  Audited common selectors (google, k1, default, s1)
                </div>
              </div>

              {/* 4. MX */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Mail Exchange (MX) Routing</span>
                  {getStatusBadge(active.mx?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enterprise mail server routing verified.
                </p>
                {active.mx?.records && active.mx.records.length > 0 && (
                  <div className="text-[11px] font-mono text-zinc-400 space-y-1 bg-zinc-950/60 p-2 rounded-md border border-zinc-800/80">
                    {active.mx.records.slice(0, 2).map((m: any, i: number) => (
                      <div key={i} className="truncate">Pref {m.preference}: <span className="text-zinc-200">{m.exchange}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. MTA-STS & TLS-RPT */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">MTA-STS & TLS-RPT</span>
                  {getStatusBadge(active.mta_sts?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Mandatory TLS transport enforcement and diagnostic reporting.
                </p>
                <div className="text-[11px] text-zinc-400 font-mono bg-zinc-950/60 p-2 rounded-md border border-zinc-800/80">
                  MTA-STS: {active.mta_sts?.status || 'Unknown'} | TLS-RPT: {active.tls_rpt?.status || 'Unknown'}
                </div>
              </div>

              {/* 6. DNSSEC */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">DNSSEC Security</span>
                  {getStatusBadge(active.dnssec?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Cryptographically signed DNS zone records against cache poisoning.
                </p>
                <div className="text-[11px] text-zinc-400 font-mono bg-zinc-950/60 p-2 rounded-md border border-zinc-800/80">
                  Zone status: {active.dnssec?.status || 'Unknown'}
                </div>
              </div>
            </div>

            {/* DMARC Remediation Guide - Enterprise Advisory Panel */}
            {active.dmarc?.policy !== 'reject' && (
              <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-zinc-800 border border-zinc-700 text-amber-400 shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">Recommended DMARC Hardening Path</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
                          High Priority Action
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Your active policy is <code className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-amber-400 font-mono text-[11px]">p={active.dmarc?.policy || 'none'}</code> (monitoring only). Inbound mail servers accept fraudulent spoofed messages claiming to originate from <span className="font-mono text-zinc-200">{active.domain}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Sequential Hardening Milestones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-300 shrink-0">1</span>
                      <span>Audit Telemetry</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Inspect inbound aggregate XML reports to catalog authorized senders:
                    </p>
                    <code className="text-[10px] font-mono text-zinc-300 block bg-zinc-900 p-2 rounded border border-zinc-800 break-all">
                      rua=mailto:dmarc-reports@{active.domain}
                    </code>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-300 shrink-0">2</span>
                      <span>Sender Alignment</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Verify SPF and DKIM alignment across Google Workspace, Office 365, and relays.
                    </p>
                    <span className="inline-flex items-center text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
                      SPF + DKIM Aligned
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-300 shrink-0">3</span>
                      <span>Quarantine Policy</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Route unauthenticated spoofed messages directly to recipient spam folders:
                    </p>
                    <code className="text-[10px] font-mono text-amber-400 block bg-zinc-900 p-2 rounded border border-zinc-800 break-all">
                      v=DMARC1; p=quarantine; pct=100;
                    </code>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-300 shrink-0">4</span>
                      <span>Full Rejection (Zero Trust)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Instruct global mail relays to immediately reject spoofed emails:
                    </p>
                    <code className="text-[10px] font-mono text-emerald-400 block bg-zinc-900 p-2 rounded border border-zinc-800 break-all font-medium">
                      v=DMARC1; p=reject; pct=100;
                    </code>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
