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
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider font-roboto bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] backdrop-blur-sm">
            PASS
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider font-roboto bg-amber-500/10 text-amber-300 border border-amber-500/40 shadow-[0_0_14px_rgba(245,158,11,0.2)] backdrop-blur-sm">
            WARNING
          </span>
        );
      case 'fail':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider font-roboto bg-rose-500/10 text-rose-300 border border-rose-500/40 shadow-[0_0_14px_rgba(244,63,94,0.2)] backdrop-blur-sm">
            FAIL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wider font-roboto bg-zinc-900/90 text-zinc-400 border border-zinc-700/80">
            NOT DETECTED
          </span>
        );
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) {
      return {
        label: 'Strong Posture',
        classes: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
        dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
      };
    }
    if (score >= 50) {
      return {
        label: 'Moderate Protection',
        classes: 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-[0_0_14px_rgba(245,158,11,0.2)]',
        dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse'
      };
    }
    return {
      label: 'Needs Enforcement',
      classes: 'bg-rose-500/10 text-rose-300 border-rose-500/40 shadow-[0_0_14px_rgba(244,63,94,0.2)]',
      dot: 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)] animate-pulse'
    };
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
            className="flex items-center gap-2.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 rounded-lg text-sm font-medium font-roboto transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {reAuditing ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <RefreshCw className="w-4 h-4 text-zinc-400" />}
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
          <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800/60 rounded-xl">
            <p className="text-xs text-zinc-400 font-roboto">No email security assessment found. Run a domain scan from Monitored Domains to generate findings.</p>
          </div>
        ) : (
          <>
            {/* Scorecard Banner */}
            {(() => {
              const badge = getScoreBadge(active.score);
              return (
                <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-roboto text-zinc-500 uppercase tracking-wider">
                      Assessed Domain: <strong className="text-zinc-300">{active.domain}</strong>
                    </span>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                      Email Protection Index
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider font-roboto border ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-xl font-roboto leading-relaxed">
                      Evaluated continuously across SPF authentication, DMARC alignment & enforcement, MX routing redundancy, and TLS transport integrity.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-zinc-950/60 p-4 border border-zinc-800/80 rounded-xl shrink-0">
                    <div className="text-center min-w-[100px]">
                      <div className={`text-4xl font-extrabold font-roboto ${active.score >= 75 ? 'text-emerald-400' : active.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {active.score}
                        <span className="text-base font-normal text-zinc-500 font-roboto"> / 100</span>
                      </div>
                      <div className="text-[11px] font-medium uppercase text-zinc-400 mt-1 font-roboto">
                        Posture Score
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Core Control Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. SPF */}
              <div className={`p-4 rounded-xl space-y-3 transition-all ${
                active.spf?.status === 'warning' ? 'bg-gradient-to-b from-amber-950/15 via-zinc-900/50 to-zinc-900/40 border border-amber-500/35 shadow-[0_0_16px_rgba(245,158,11,0.06)]' :
                active.spf?.status === 'fail' ? 'bg-gradient-to-b from-rose-950/15 via-zinc-900/50 to-zinc-900/40 border border-rose-500/35 shadow-[0_0_16px_rgba(244,63,94,0.06)]' :
                'bg-zinc-900/40 border border-zinc-800/80'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">SPF (Sender Policy Framework)</span>
                  {getStatusBadge(active.spf?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-roboto">
                  {active.spf?.details || 'Validates sending server IP addresses against published domain policy.'}
                </p>
                {active.spf?.record && (
                  <div className="p-2.5 bg-zinc-950 border border-zinc-800/90 rounded-lg text-[11px] font-roboto text-zinc-300 break-all leading-relaxed">
                    {active.spf.record}
                  </div>
                )}
              </div>

              {/* 2. DMARC */}
              <div className={`p-4 rounded-xl space-y-3 transition-all ${
                active.dmarc?.status === 'warning' ? 'bg-gradient-to-b from-amber-950/15 via-zinc-900/50 to-zinc-900/40 border border-amber-500/35 shadow-[0_0_16px_rgba(245,158,11,0.06)]' :
                active.dmarc?.status === 'fail' ? 'bg-gradient-to-b from-rose-950/15 via-zinc-900/50 to-zinc-900/40 border border-rose-500/35 shadow-[0_0_16px_rgba(244,63,94,0.06)]' :
                'bg-zinc-900/40 border border-zinc-800/80'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">DMARC Enforcement</span>
                  {getStatusBadge(active.dmarc?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-roboto">
                  {active.dmarc?.details || 'Policy instruction for receiving mail agents on spoofed messages.'}
                </p>
                {active.dmarc?.record && (
                  <div className="p-2.5 bg-zinc-950 border border-zinc-800/90 rounded-lg text-[11px] font-roboto text-zinc-300 break-all leading-relaxed">
                    {active.dmarc.record}
                  </div>
                )}
              </div>

              {/* 3. DKIM */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">DKIM Public Verification</span>
                  {getStatusBadge(active.dkim?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-roboto">
                  {active.dkim?.details || 'Cryptographic signature verification on outbound messages.'}
                </p>
                <div className="text-[11px] text-zinc-500 font-roboto">
                  Audited common selectors (google, k1, default, s1)
                </div>
              </div>

              {/* 4. MX */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Mail Exchange (MX) Routing</span>
                  {getStatusBadge(active.mx?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-roboto">
                  Enterprise mail server routing verified.
                </p>
                {active.mx?.records && active.mx.records.length > 0 && (
                  <div className="text-[11px] font-roboto text-zinc-400 space-y-1 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                    {active.mx.records.slice(0, 2).map((m: any, i: number) => (
                      <div key={i} className="truncate">Pref {m.preference}: <span className="text-zinc-200">{m.exchange}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. MTA-STS & TLS-RPT */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">MTA-STS & TLS-RPT</span>
                  {getStatusBadge(active.mta_sts?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-roboto">
                  Mandatory TLS transport enforcement and diagnostic reporting.
                </p>
                <div className="text-[11px] text-zinc-500 font-roboto bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                  MTA-STS: {active.mta_sts?.status} | TLS-RPT: {active.tls_rpt?.status}
                </div>
              </div>

              {/* 6. DNSSEC */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">DNSSEC Security</span>
                  {getStatusBadge(active.dnssec?.status)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-roboto">
                  Cryptographically signed DNS zone records against cache poisoning.
                </p>
                <div className="text-[11px] text-zinc-500 font-roboto bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                  Zone status: {active.dnssec?.status}
                </div>
              </div>
            </div>

            {/* DMARC Remediation Guide - Modern Cyber-Grade Advisory Box */}
            {active.dmarc?.policy !== 'reject' && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/35 via-zinc-900/90 to-zinc-950 border border-amber-500/40 p-5 sm:p-6 space-y-4 shadow-[0_4px_28px_rgba(245,158,11,0.1)]">
                {/* Left vertical glowing accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.25)] shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white tracking-tight">Recommended DMARC Hardening Path</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-roboto font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                          High Priority Action
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 font-roboto leading-relaxed">
                        Your active policy is <code className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700/80 rounded text-amber-300 font-roboto font-semibold">p={active.dmarc?.policy || 'none'}</code> (monitoring only). Inbound mail servers accept fraudulent spoofed messages claiming to originate from <span className="font-roboto text-white">{active.domain}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Sequential Hardening Milestones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 font-roboto">
                  <div className="p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-roboto text-amber-300 shrink-0">1</span>
                      <span>Audit Telemetry</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Inspect inbound aggregate XML reports to catalog all authorized senders:
                    </p>
                    <code className="text-[10px] font-roboto text-zinc-200 block bg-zinc-900 p-2 rounded-lg border border-zinc-800 break-all">
                      rua=mailto:dmarc-reports@{active.domain}
                    </code>
                  </div>

                  <div className="p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-roboto text-amber-300 shrink-0">2</span>
                      <span>Sender Alignment</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Verify SPF and DKIM alignment across Google Workspace, Office 365, and marketing relays.
                    </p>
                    <span className="inline-flex items-center text-[10px] font-roboto font-semibold text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.12)]">
                      SPF + DKIM Aligned
                    </span>
                  </div>

                  <div className="p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-roboto text-amber-300 shrink-0">3</span>
                      <span>Quarantine Policy</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Route unauthenticated spoofed messages directly to recipient spam/junk folders:
                    </p>
                    <code className="text-[10px] font-roboto text-amber-200 block bg-zinc-900 p-2 rounded-lg border border-amber-500/30 break-all">
                      v=DMARC1; p=quarantine; pct=100;
                    </code>
                  </div>

                  <div className="p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-roboto text-emerald-300 shrink-0">4</span>
                      <span>Full Rejection (Zero Trust)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Instruct all global mail relays to immediately reject spoofed emails before delivery:
                    </p>
                    <code className="text-[10px] font-roboto text-emerald-300 block bg-zinc-900 p-2 rounded-lg border border-emerald-500/30 break-all font-semibold">
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
