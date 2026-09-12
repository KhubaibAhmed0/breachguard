"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Shield, Network, MailCheck, Radar, KeyRound, 
  AlertTriangle, CheckCircle2, ArrowRight, HelpCircle, 
  Calculator, Sparkles, AlertCircle, Info, TrendingDown
} from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';

export type PillarKey = 'overall' | 'attack_surface' | 'email_security' | 'threat_intelligence' | 'credential_exposure';

interface ScoreBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PillarKey;
  breakdown?: any;
  overallScore?: number;
  riskLevel?: string;
  categories?: {
    attack_surface: number;
    email_security: number;
    threat_intelligence: number;
    credential_exposure: number;
  };
  domainCount?: number;
}

export function ScoreBreakdownModal({
  isOpen,
  onClose,
  initialTab = 'overall',
  breakdown,
  overallScore = 0,
  riskLevel = 'LOW RISK',
  categories = { attack_surface: 0, email_security: 0, threat_intelligence: 0, credential_exposure: 0 },
  domainCount = 0
}: ScoreBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<PillarKey>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pillars = breakdown?.pillars || {};
  const contributions = breakdown?.pillar_contributions || {};

  const getPillarData = (key: PillarKey) => {
    switch (key) {
      case 'attack_surface':
        return {
          title: 'Attack Surface Posture',
          icon: Network,
          weight: '30%',
          score: pillars.attack_surface?.score ?? categories.attack_surface,
          baseScore: pillars.attack_surface?.base_score ?? 100,
          deductions: pillars.attack_surface?.deductions ?? [],
          methodology: pillars.attack_surface?.methodology ?? 'Calculated from passive discovery of public DNS records, open service ports, and web technologies.',
          riskContribution: contributions.attack_surface?.risk_points ?? 0,
        };
      case 'email_security':
        return {
          title: 'Email Security Posture',
          icon: MailCheck,
          weight: '25%',
          score: pillars.email_security?.score ?? categories.email_security,
          baseScore: pillars.email_security?.base_score ?? 100,
          deductions: pillars.email_security?.deductions ?? [],
          methodology: pillars.email_security?.methodology ?? 'Derived from RFC 7208 (SPF), RFC 7489 (DMARC policy enforcement), discoverable DKIM, MX hosts, and transport security.',
          riskContribution: contributions.email_security?.risk_points ?? 0,
        };
      case 'threat_intelligence':
        return {
          title: 'Threat Intelligence Posture',
          icon: Radar,
          weight: '20%',
          score: pillars.threat_intelligence?.score ?? categories.threat_intelligence,
          baseScore: pillars.threat_intelligence?.base_score ?? 100,
          deductions: pillars.threat_intelligence?.deductions ?? [],
          methodology: pillars.threat_intelligence?.methodology ?? 'Cross-referenced against verified public breach disclosures, darkweb repositories, and IP/domain reputation feeds.',
          riskContribution: contributions.threat_intelligence?.risk_points ?? 0,
        };
      case 'credential_exposure':
        return {
          title: 'Credential Exposure Posture',
          icon: KeyRound,
          weight: '25%',
          score: pillars.credential_exposure?.score ?? categories.credential_exposure,
          baseScore: pillars.credential_exposure?.base_score ?? 100,
          deductions: pillars.credential_exposure?.deductions ?? [],
          methodology: pillars.credential_exposure?.methodology ?? 'Evaluates compromised organizational email identities detected in public or illicit credential dumps, weighted by severity.',
          riskContribution: contributions.credential_exposure?.risk_points ?? 0,
        };
      default:
        return null;
    }
  };

  const currentPillar = getPillarData(activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-bg-overlay animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-bg-base border border-border-default rounded-lg overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border-default bg-bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-bg-inset border border-border-strong text-text-secondary">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2">
                Score Transparency &amp; Deduction Breakdown
                <span className="text-2xs px-1.5 py-0.5 rounded bg-bg-inset text-text-muted border border-border-default font-mono font-normal">
                  Deterministic v2.4
                </span>
              </h3>
              <p className="text-xs text-text-muted font-roboto">
                Every metric is grounded in verifiable external reconnaissance. Zero guesswork or arbitrary penalties.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-border-strong transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 pb-2 border-b border-border-default bg-bg-base overflow-x-auto">
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'overall'
                ? 'bg-bg-inset text-text-primary border border-border-strong'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-text-muted" />
            Overall Risk ({overallScore}/100)
          </button>
          <button
            onClick={() => setActiveTab('attack_surface')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'attack_surface'
                ? 'bg-bg-inset text-text-primary border border-border-strong'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-text-muted" />
            Attack Surface ({categories.attack_surface}/100)
          </button>
          <button
            onClick={() => setActiveTab('email_security')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'email_security'
                ? 'bg-bg-inset text-text-primary border border-border-strong'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
            }`}
          >
            <MailCheck className="w-3.5 h-3.5 text-text-muted" />
            Email Security ({categories.email_security}/100)
          </button>
          <button
            onClick={() => setActiveTab('threat_intelligence')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'threat_intelligence'
                ? 'bg-bg-inset text-text-primary border border-border-strong'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
            }`}
          >
            <Radar className="w-3.5 h-3.5 text-text-muted" />
            Threat Intel ({categories.threat_intelligence}/100)
          </button>
          <button
            onClick={() => setActiveTab('credential_exposure')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'credential_exposure'
                ? 'bg-bg-inset text-text-primary border border-border-strong'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-text-muted" />
            Credential Exposure ({categories.credential_exposure}/100)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm font-roboto">
          {activeTab === 'overall' ? (
            /* OVERALL RISK VIEW */
            <div className="space-y-5">
              {/* Important Clarification Banner */}
              <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default space-y-1.5">
                <div className="flex items-center gap-2 text-text-secondary font-medium text-xs">
                  <Info className="w-4 h-4 text-text-muted shrink-0" />
                  Understanding BreachGuard Risk vs. Posture
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  The <strong className="text-text-secondary">4 Category Pillars</strong> represent <strong className="text-emerald-400">Security Defense Posture (0–100)</strong>, where 100 represents a clean perimeter.
                  The <strong className="text-text-secondary">External Cyber Risk Score (0–100)</strong> inverts your defense posture into active attacker exposure (<code className="text-text-secondary px-1 py-0.5 rounded bg-bg-surface border border-border-default">100 − Posture</code>), where 0 is minimal risk and 100 is critical exposure.
                </p>
              </div>

              {/* Mathematical Formula Card */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5">
                <span className="text-xs font-medium text-text-muted">Weighted Derivation Formula</span>
                <div className="p-2.5 rounded bg-bg-base border border-border-default font-mono text-xs text-text-secondary overflow-x-auto leading-relaxed">
                  Risk = 100 − [ (30% × Attack Surface) + (25% × Email Posture) + (20% × Threat Intel) + (25% × Credential Posture) ]
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-text-muted pt-1 font-mono">
                  <span>Weighted Defense Posture: <strong className="text-text-primary">{breakdown?.weighted_posture_score ?? (100 - overallScore)}/100</strong></span>
                  <span>Active Cyber Risk: <strong className="text-text-primary">{overallScore}/100 ({riskLevel})</strong></span>
                </div>
              </div>

              {/* Risk Level Thresholds & Interpretation Scale */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">Risk Score Interpretation Scale (0–100)</span>
                  <span className="text-2xs text-text-faint font-mono">Lower score is safer (0 = Pristine)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-roboto">
                  <div className={`p-3 rounded-md border transition-colors ${overallScore < 35 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-bg-surface border-border-default text-text-muted'}`}>
                    <div className="font-semibold text-emerald-400 flex items-center justify-between font-mono">
                      <span>Low Risk</span>
                      <span className="text-2xs">0–34</span>
                    </div>
                    <div className="text-2xs text-text-muted mt-1">Perimeter secure. Minimal external exposure detected.</div>
                  </div>
                  <div className={`p-3 rounded-md border transition-colors ${overallScore >= 35 && overallScore < 60 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-bg-surface border-border-default text-text-muted'}`}>
                    <div className="font-semibold text-amber-400 flex items-center justify-between font-mono">
                      <span>Medium Risk</span>
                      <span className="text-2xs">35–59</span>
                    </div>
                    <div className="text-2xs text-text-muted mt-1">Moderate exposure. Email hardening &amp; perimeter clean-up advised.</div>
                  </div>
                  <div className={`p-3 rounded-md border transition-colors ${overallScore >= 60 && overallScore < 75 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-bg-surface border-border-default text-text-muted'}`}>
                    <div className="font-semibold text-orange-400 flex items-center justify-between font-mono">
                      <span>High Risk</span>
                      <span className="text-2xs">60–74</span>
                    </div>
                    <div className="text-2xs text-text-muted mt-1">Elevated threat. Vulnerable open ports or active breaches observed.</div>
                  </div>
                  <div className={`p-3 rounded-md border transition-colors ${overallScore >= 75 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-bg-surface border-border-default text-text-muted'}`}>
                    <div className="font-semibold text-rose-400 flex items-center justify-between font-mono">
                      <span>Critical Risk</span>
                      <span className="text-2xs">75–100</span>
                    </div>
                    <div className="text-2xs text-text-muted mt-1">Immediate action required. Sensitive services or plaintext creds exposed.</div>
                  </div>
                </div>
              </div>

              {/* Pillar Contributions Breakdown Table */}
              <div className="space-y-2.5">
                <span className="text-xs font-medium text-text-muted">Pillar Risk Contributions</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Attack Surface */}
                  <div 
                    onClick={() => setActiveTab('attack_surface')}
                    className="p-3.5 rounded-lg bg-bg-surface hover:bg-bg-hover border border-border-default hover:border-border-strong transition-colors cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network className="w-3.5 h-3.5 text-text-muted" />
                        <span className="font-medium text-text-secondary text-xs">Attack Surface (30% weight)</span>
                      </div>
                      <span className="text-xs font-mono text-text-faint group-hover:text-text-secondary">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="text-text-muted">Posture: <strong className="text-text-primary">{categories.attack_surface}/100</strong></span>
                      <span className="text-text-muted">Risk Added: <strong className="text-amber-400">+{contributions.attack_surface?.risk_points ?? ((100 - categories.attack_surface) * 0.3).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-border-strong h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-text-secondary h-full rounded-full transition-all" 
                        style={{ width: `${categories.attack_surface}%` }}
                      />
                    </div>
                  </div>

                  {/* Email Security */}
                  <div 
                    onClick={() => setActiveTab('email_security')}
                    className="p-3.5 rounded-lg bg-bg-surface hover:bg-bg-hover border border-border-default hover:border-border-strong transition-colors cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MailCheck className="w-3.5 h-3.5 text-text-muted" />
                        <span className="font-medium text-text-secondary text-xs">Email Security (25% weight)</span>
                      </div>
                      <span className="text-xs font-mono text-text-faint group-hover:text-text-secondary">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="text-text-muted">Posture: <strong className="text-text-primary">{categories.email_security}/100</strong></span>
                      <span className="text-text-muted">Risk Added: <strong className="text-amber-400">+{contributions.email_security?.risk_points ?? ((100 - categories.email_security) * 0.25).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-border-strong h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-text-secondary h-full rounded-full transition-all" 
                        style={{ width: `${categories.email_security}%` }}
                      />
                    </div>
                  </div>

                  {/* Threat Intelligence */}
                  <div 
                    onClick={() => setActiveTab('threat_intelligence')}
                    className="p-3.5 rounded-lg bg-bg-surface hover:bg-bg-hover border border-border-default hover:border-border-strong transition-colors cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radar className="w-3.5 h-3.5 text-text-muted" />
                        <span className="font-medium text-text-secondary text-xs">Threat Intel (20% weight)</span>
                      </div>
                      <span className="text-xs font-mono text-text-faint group-hover:text-text-secondary">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="text-text-muted">Posture: <strong className="text-text-primary">{categories.threat_intelligence}/100</strong></span>
                      <span className="text-text-muted">Risk Added: <strong className="text-amber-400">+{contributions.threat_intelligence?.risk_points ?? ((100 - categories.threat_intelligence) * 0.2).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-border-strong h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-text-secondary h-full rounded-full transition-all" 
                        style={{ width: `${categories.threat_intelligence}%` }}
                      />
                    </div>
                  </div>

                  {/* Credential Exposure */}
                  <div 
                    onClick={() => setActiveTab('credential_exposure')}
                    className="p-3.5 rounded-lg bg-bg-surface hover:bg-bg-hover border border-border-default hover:border-border-strong transition-colors cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-text-muted" />
                        <span className="font-medium text-text-secondary text-xs">Credential Exposure (25% weight)</span>
                      </div>
                      <span className="text-xs font-mono text-text-faint group-hover:text-text-secondary">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="text-text-muted">Posture: <strong className="text-text-primary">{categories.credential_exposure}/100</strong></span>
                      <span className="text-text-muted">Risk Added: <strong className="text-amber-400">+{contributions.credential_exposure?.risk_points ?? ((100 - categories.credential_exposure) * 0.25).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-border-strong h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-text-secondary h-full rounded-full transition-all" 
                        style={{ width: `${categories.credential_exposure}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Remediation Simulator Tip */}
              <div className="p-4 rounded-lg bg-bg-surface border border-border-default flex items-start gap-3">
                <div className="p-1.5 rounded bg-bg-inset border border-border-strong text-text-secondary shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-text-primary">Deterministic Path to Minimal Risk</span>
                    <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-bg-inset text-text-secondary border border-border-default">
                      High Impact
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed font-roboto">
                    Remediating open perimeter findings or advancing your email anti-spoofing policy (<code className="text-text-secondary px-1 py-0.5 rounded bg-bg-base border border-border-default font-mono">p=reject</code>) restores up to +20 posture points, driving active cyber risk down to single digits.
                  </p>
                </div>
              </div>
            </div>
          ) : currentPillar ? (
            /* INDIVIDUAL PILLAR VIEW */
            <div className="space-y-6">
              {/* Header stats of this pillar */}
              <div className="p-4 rounded-xl bg-bg-surface border border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <currentPillar.icon className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-semibold text-text-primary">{currentPillar.title}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-border-strong text-text-secondary font-roboto">
                      Weight: {currentPillar.weight}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    {currentPillar.methodology}
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-bg-base px-4 py-2.5 rounded-lg border border-border-default shrink-0">
                  <div className="text-right">
                    <div className="text-2xl font-bold font-roboto text-text-primary">
                      {currentPillar.score}<span className="text-xs text-text-faint"> / 100</span>
                    </div>
                    <div className="text-2xs text-text-muted font-roboto uppercase">
                      Baseline: {currentPillar.baseScore} pts
                    </div>
                  </div>
                </div>
              </div>

              {/* Deductions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Evidence-Based Deductions ({currentPillar.deductions.length})
                  </span>
                  {currentPillar.deductions.length > 0 && (
                    <span className="text-xs font-roboto text-red-400">
                      Total Deducted: -{currentPillar.baseScore - currentPillar.score} pts
                    </span>
                  )}
                </div>

                {currentPillar.deductions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-text-secondary">Zero Deductions Detected</div>
                    <p className="text-xs text-text-muted max-w-md mx-auto">
                      All observable telemetry meets optimal baseline requirements. No vulnerabilities, unauthenticated relays, or exposures were found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {currentPillar.deductions.map((d: any, idx: number) => {
                      const points = d.points_deducted ?? 0;
                      const sev = (d.severity || (points >= 20 ? 'critical' : points >= 15 ? 'high' : 'medium')).toLowerCase();
                      return (
                        <div 
                          key={idx} 
                          className="p-3.5 rounded-lg bg-bg-surface border border-border-default space-y-2 hover:bg-bg-hover transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <SeverityBadge severity={sev as any} />
                                <span className="font-medium text-text-primary text-xs">
                                  {d.title || d.reason}
                                </span>
                                {d.finding_id && (
                                  <span className="text-2xs font-mono text-text-faint">
                                    [{d.finding_id}]
                                  </span>
                                )}
                              </div>
                              {d.asset && (
                                <div className="text-xs text-text-muted font-mono">
                                  Asset Target: <strong className="text-text-secondary">{d.asset}</strong>
                                </div>
                              )}
                              {d.evidence && (
                                <div className="text-xs text-text-secondary bg-bg-surface p-2 rounded-md border border-border-default font-mono text-2xs">
                                  Telemetry Evidence: <span className="text-text-secondary font-normal">{d.evidence}</span>
                                </div>
                              )}
                              {d.impact && (
                                <p className="text-xs text-text-muted">
                                  <strong className="text-text-secondary">Impact: </strong>{d.impact}
                                </p>
                              )}
                            </div>

                            <div className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 font-mono font-medium text-xs shrink-0">
                              -{points} pts
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-border-default bg-bg-surface flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center gap-1.5 text-text-muted">
            <Shield className="w-3.5 h-3.5 text-text-faint" />
            Active scope: {domainCount} Monitored Domain(s)
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-border-strong hover:bg-border-strong text-text-secondary hover:text-text-primary font-medium text-xs transition-colors cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
