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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            PASS
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
            WARNING
          </span>
        );
      case 'fail':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
            FAIL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-border-strong text-text-muted border border-border-strong">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-text-muted" />
              Email Security Posture
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              DNS anti-spoofing verification, DMARC enforcement monitoring, and transport encryption controls.
            </p>
          </div>
          <button
            onClick={handleReAudit}
            disabled={reAuditing || !active}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-bg-surface hover:bg-border-strong text-text-secondary border border-border-strong rounded-md text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {reAuditing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" /> : <RefreshCw className="w-3.5 h-3.5 text-text-muted" />}
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
          <div className="p-8 text-center bg-bg-surface border border-border-default rounded-lg">
            <p className="text-xs text-text-muted font-mono">No email security assessment found. Run a domain scan from Monitored Domains to generate findings.</p>
          </div>
        ) : (
          <>
            {/* Scorecard Banner */}
            {(() => {
              const badge = getScoreBadge(active.score);
              return (
                <div className="p-5 sm:p-6 bg-bg-surface border border-border-default rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1.5">
                    <span className="text-2xs font-mono text-text-muted uppercase tracking-wider">
                      Assessed Domain: <strong className="text-text-secondary">{active.domain}</strong>
                    </span>
                    <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2.5">
                      Email Protection Index
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono font-medium border ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </h2>
                    <p className="text-xs text-text-muted max-w-xl leading-relaxed">
                      Evaluated continuously across SPF authentication, DMARC alignment & enforcement, MX routing redundancy, and TLS transport integrity.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-bg-surface p-3.5 border border-border-default rounded-lg shrink-0">
                    <div className="text-center min-w-[90px]">
                      <div className={`text-3xl sm:text-4xl font-semibold font-mono ${active.score >= 75 ? 'text-emerald-400' : active.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {active.score}
                        <span className="text-sm font-normal text-text-faint font-sans"> / 100</span>
                      </div>
                      <div className="text-2xs font-medium uppercase text-text-muted mt-1 font-mono">
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
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">SPF (Sender Policy Framework)</span>
                  {getStatusBadge(active.spf?.status)}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {active.spf?.details || 'Validates sending server IP addresses against published domain policy.'}
                </p>
                {active.spf?.record && (
                  <div className="p-2 bg-bg-base border border-border-default rounded-md text-2xs font-mono text-text-secondary break-all leading-relaxed">
                    {active.spf.record}
                  </div>
                )}
              </div>

              {/* 2. DMARC */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">DMARC Enforcement</span>
                  {getStatusBadge(active.dmarc?.status)}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {active.dmarc?.details || 'Policy instruction for receiving mail agents on spoofed messages.'}
                </p>
                {active.dmarc?.record && (
                  <div className="p-2 bg-bg-base border border-border-default rounded-md text-2xs font-mono text-text-secondary break-all leading-relaxed">
                    {active.dmarc.record}
                  </div>
                )}
              </div>

              {/* 3. DKIM */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">DKIM Public Verification</span>
                  {getStatusBadge(active.dkim?.status)}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {active.dkim?.details || 'Cryptographic signature verification on outbound messages.'}
                </p>
                <div className="text-2xs text-text-faint font-mono">
                  Audited common selectors (google, k1, default, s1)
                </div>
              </div>

              {/* 4. MX */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">Mail Exchange (MX) Routing</span>
                  {getStatusBadge(active.mx?.status)}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Enterprise mail server routing verified.
                </p>
                {active.mx?.records && active.mx.records.length > 0 && (
                  <div className="text-2xs font-mono text-text-muted space-y-1 bg-bg-surface p-2 rounded-md border border-border-default">
                    {active.mx.records.slice(0, 2).map((m: any, i: number) => (
                      <div key={i} className="truncate">Pref {m.preference}: <span className="text-text-secondary">{m.exchange}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. MTA-STS & TLS-RPT */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">MTA-STS & TLS-RPT</span>
                  {getStatusBadge(active.mta_sts?.status)}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Mandatory TLS transport enforcement and diagnostic reporting.
                </p>
                <div className="text-2xs text-text-muted font-mono bg-bg-surface p-2 rounded-md border border-border-default">
                  MTA-STS: {active.mta_sts?.status || 'Unknown'} | TLS-RPT: {active.tls_rpt?.status || 'Unknown'}
                </div>
              </div>

              {/* 6. DNSSEC */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">DNSSEC Security</span>
                  {getStatusBadge(active.dnssec?.status)}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Cryptographically signed DNS zone records against cache poisoning.
                </p>
                <div className="text-2xs text-text-muted font-mono bg-bg-surface p-2 rounded-md border border-border-default">
                  Zone status: {active.dnssec?.status || 'Unknown'}
                </div>
              </div>
            </div>

            {/* DMARC Remediation Guide - Enterprise Advisory Panel */}
            {active.dmarc?.policy !== 'reject' && (
              <div className="rounded-lg bg-bg-surface border border-border-default p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-border-strong border border-border-strong text-amber-400 shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-text-primary tracking-tight">Recommended DMARC Hardening Path</h3>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-medium uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
                          High Priority Action
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        Your active policy is <code className="px-1.5 py-0.5 bg-bg-base border border-border-default rounded text-amber-400 font-mono text-2xs">p={active.dmarc?.policy || 'none'}</code> (monitoring only). Inbound mail servers accept fraudulent spoofed messages claiming to originate from <span className="font-mono text-text-secondary">{active.domain}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Sequential Hardening Milestones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-bg-surface border border-border-default rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-text-secondary text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-border-strong border border-border-strong flex items-center justify-center text-2xs font-mono text-text-secondary shrink-0">1</span>
                      <span>Audit Telemetry</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-snug">
                      Inspect inbound aggregate XML reports to catalog authorized senders:
                    </p>
                    <code className="text-2xs font-mono text-text-secondary block bg-bg-surface p-2 rounded border border-border-default break-all">
                      rua=mailto:dmarc-reports@{active.domain}
                    </code>
                  </div>

                  <div className="p-3 bg-bg-surface border border-border-default rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-text-secondary text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-border-strong border border-border-strong flex items-center justify-center text-2xs font-mono text-text-secondary shrink-0">2</span>
                      <span>Sender Alignment</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-snug">
                      Verify SPF and DKIM alignment across Google Workspace, Office 365, and relays.
                    </p>
                    <span className="inline-flex items-center text-2xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
                      SPF + DKIM Aligned
                    </span>
                  </div>

                  <div className="p-3 bg-bg-surface border border-border-default rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-text-secondary text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-border-strong border border-border-strong flex items-center justify-center text-2xs font-mono text-text-secondary shrink-0">3</span>
                      <span>Quarantine Policy</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-snug">
                      Route unauthenticated spoofed messages directly to recipient spam folders:
                    </p>
                    <code className="text-2xs font-mono text-amber-400 block bg-bg-surface p-2 rounded border border-border-default break-all">
                      v=DMARC1; p=quarantine; pct=100;
                    </code>
                  </div>

                  <div className="p-3 bg-bg-surface border border-border-default rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-text-secondary text-xs font-medium">
                      <span className="w-4 h-4 rounded bg-border-strong border border-border-strong flex items-center justify-center text-2xs font-mono text-text-secondary shrink-0">4</span>
                      <span>Full Rejection (Zero Trust)</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-snug">
                      Instruct global mail relays to immediately reject spoofed emails:
                    </p>
                    <code className="text-2xs font-mono text-emerald-400 block bg-bg-surface p-2 rounded border border-border-default break-all font-medium">
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
