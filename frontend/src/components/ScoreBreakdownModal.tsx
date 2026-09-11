"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Shield, Network, MailCheck, Radar, KeyRound, 
  AlertTriangle, CheckCircle2, ArrowRight, HelpCircle, 
  Calculator, Sparkles, AlertCircle, Info, TrendingDown
} from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Score Transparency & Deduction Breakdown
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-roboto font-normal">
                  Deterministic v2.4
                </span>
              </h3>
              <p className="text-xs text-zinc-400 font-roboto">
                Every metric is grounded in verifiable external reconnaissance. Zero guesswork or arbitrary penalties.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-950 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-roboto transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'overall'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Overall Risk ({overallScore}/100)
          </button>
          <button
            onClick={() => setActiveTab('attack_surface')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-roboto transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'attack_surface'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            Attack Surface ({categories.attack_surface}/100)
          </button>
          <button
            onClick={() => setActiveTab('email_security')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-roboto transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'email_security'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <MailCheck className="w-3.5 h-3.5 text-emerald-400" />
            Email Security ({categories.email_security}/100)
          </button>
          <button
            onClick={() => setActiveTab('threat_intelligence')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-roboto transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'threat_intelligence'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Radar className="w-3.5 h-3.5 text-blue-400" />
            Threat Intel ({categories.threat_intelligence}/100)
          </button>
          <button
            onClick={() => setActiveTab('credential_exposure')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-roboto transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'credential_exposure'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            Credential Exposure ({categories.credential_exposure}/100)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-roboto">
          {activeTab === 'overall' ? (
            /* OVERALL RISK VIEW */
            <div className="space-y-6">
              {/* Important Clarification Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                  Understanding BreachGuard Risk vs. Posture
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  The <strong className="text-white">4 Category Pillars</strong> represent <strong className="text-emerald-400">Security Defense Posture (0–100)</strong>, where 100 represents a clean perimeter with zero vulnerabilities.
                  The <strong className="text-white">External Cyber Risk Score (0–100)</strong> inverts your weighted defense posture into active attacker exposure (<code className="text-indigo-300 px-1 py-0.5 rounded bg-indigo-900/40">100 − Posture</code>), where 0 is minimal risk and 100 is critical exposure.
                </p>
              </div>

              {/* Mathematical Formula Card */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Weighted Derivation Formula</span>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-roboto text-xs text-zinc-200 overflow-x-auto leading-relaxed">
                  Risk = 100 − [ (30% × Attack Surface) + (25% × Email Posture) + (20% × Threat Intel) + (25% × Credential Posture) ]
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 pt-1">
                  <span>Weighted Defense Posture: <strong className="text-white font-roboto">{breakdown?.weighted_posture_score ?? (100 - overallScore)}/100</strong></span>
                  <span>Active Cyber Risk: <strong className="text-indigo-400 font-roboto">{overallScore}/100 ({riskLevel})</strong></span>
                </div>
              </div>

              {/* Pillar Contributions Breakdown Table */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pillar Risk Contributions</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Attack Surface */}
                  <div 
                    onClick={() => setActiveTab('attack_surface')}
                    className="p-3.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold text-zinc-200 text-xs">Attack Surface (30% weight)</span>
                      </div>
                      <span className="text-xs font-roboto text-zinc-400 group-hover:text-cyan-400 flex items-center gap-1">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-roboto">
                      <span className="text-zinc-400">Defense Posture: <strong className="text-white">{categories.attack_surface}/100</strong></span>
                      <span className="text-zinc-400">Risk Added: <strong className="text-amber-400">+{contributions.attack_surface?.risk_points ?? ((100 - categories.attack_surface) * 0.3).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full rounded-full transition-all" 
                        style={{ width: `${categories.attack_surface}%` }}
                      />
                    </div>
                  </div>

                  {/* Email Security */}
                  <div 
                    onClick={() => setActiveTab('email_security')}
                    className="p-3.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MailCheck className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-zinc-200 text-xs">Email Security (25% weight)</span>
                      </div>
                      <span className="text-xs font-roboto text-zinc-400 group-hover:text-emerald-400 flex items-center gap-1">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-roboto">
                      <span className="text-zinc-400">Defense Posture: <strong className="text-white">{categories.email_security}/100</strong></span>
                      <span className="text-zinc-400">Risk Added: <strong className="text-amber-400">+{contributions.email_security?.risk_points ?? ((100 - categories.email_security) * 0.25).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all" 
                        style={{ width: `${categories.email_security}%` }}
                      />
                    </div>
                  </div>

                  {/* Threat Intelligence */}
                  <div 
                    onClick={() => setActiveTab('threat_intelligence')}
                    className="p-3.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radar className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-zinc-200 text-xs">Threat Intel (20% weight)</span>
                      </div>
                      <span className="text-xs font-roboto text-zinc-400 group-hover:text-blue-400 flex items-center gap-1">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-roboto">
                      <span className="text-zinc-400">Defense Posture: <strong className="text-white">{categories.threat_intelligence}/100</strong></span>
                      <span className="text-zinc-400">Risk Added: <strong className="text-amber-400">+{contributions.threat_intelligence?.risk_points ?? ((100 - categories.threat_intelligence) * 0.2).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all" 
                        style={{ width: `${categories.threat_intelligence}%` }}
                      />
                    </div>
                  </div>

                  {/* Credential Exposure */}
                  <div 
                    onClick={() => setActiveTab('credential_exposure')}
                    className="p-3.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-zinc-200 text-xs">Credential Exposure (25% weight)</span>
                      </div>
                      <span className="text-xs font-roboto text-zinc-400 group-hover:text-amber-400 flex items-center gap-1">
                        Inspect &rarr;
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs font-roboto">
                      <span className="text-zinc-400">Defense Posture: <strong className="text-white">{categories.credential_exposure}/100</strong></span>
                      <span className="text-zinc-400">Risk Added: <strong className="text-amber-400">+{contributions.credential_exposure?.risk_points ?? ((100 - categories.credential_exposure) * 0.25).toFixed(1)} pts</strong></span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all" 
                        style={{ width: `${categories.credential_exposure}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Remediation Simulator Tip - Modernized Enterprise Advisory */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/30 via-zinc-900/90 to-zinc-950 border border-emerald-500/35 p-5 flex items-start gap-3.5 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)] shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white tracking-tight">Deterministic Path to Minimal Risk</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-roboto font-semibold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      High Impact
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-roboto">
                    Remediating open perimeter findings or advancing your email anti-spoofing policy (<code className="text-emerald-300 px-1.5 py-0.5 rounded bg-zinc-900 border border-emerald-900/60 font-roboto">p=reject</code>) restores up to +20 posture points, driving active cyber risk down to single digits.
                  </p>
                </div>
              </div>
            </div>
          ) : currentPillar ? (
            /* INDIVIDUAL PILLAR VIEW */
            <div className="space-y-6">
              {/* Header stats of this pillar */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <currentPillar.icon className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-semibold text-white">{currentPillar.title}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-roboto">
                      Weight: {currentPillar.weight}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {currentPillar.methodology}
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-zinc-950 px-4 py-2.5 rounded-lg border border-zinc-800/80 shrink-0">
                  <div className="text-right">
                    <div className="text-2xl font-bold font-roboto text-white">
                      {currentPillar.score}<span className="text-xs text-zinc-500"> / 100</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-roboto uppercase">
                      Baseline: {currentPillar.baseScore} pts
                    </div>
                  </div>
                </div>
              </div>

              {/* Deductions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Evidence-Based Deductions ({currentPillar.deductions.length})
                  </span>
                  {currentPillar.deductions.length > 0 && (
                    <span className="text-xs font-roboto text-red-400">
                      Total Deducted: -{currentPillar.baseScore - currentPillar.score} pts
                    </span>
                  )}
                </div>

                {currentPillar.deductions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/60 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-zinc-200">Zero Deductions Detected</div>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      All observable telemetry meets optimal baseline requirements. No vulnerabilities, unauthenticated relays, or exposures were found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {currentPillar.deductions.map((d: any, idx: number) => {
                      const points = d.points_deducted ?? 0;
                      const sev = (d.severity || (points >= 20 ? 'critical' : points >= 15 ? 'high' : 'medium')).toLowerCase();
                      const getDeductionBadge = (severity: string) => {
                        switch (severity) {
                          case 'critical':
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-roboto uppercase font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/35 shadow-[0_0_10px_rgba(244,63,94,0.18)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                CRITICAL
                              </span>
                            );
                          case 'high':
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-roboto uppercase font-semibold bg-orange-500/10 text-orange-300 border border-orange-500/35 shadow-[0_0_10px_rgba(249,115,22,0.18)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                                HIGH
                              </span>
                            );
                          default:
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-roboto uppercase font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.18)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                MEDIUM
                              </span>
                            );
                        }
                      };

                      return (
                        <div 
                          key={idx} 
                          className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/90 space-y-2 hover:bg-zinc-900/80 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getDeductionBadge(sev)}
                                <span className="font-semibold text-white text-xs">
                                  {d.title || d.reason}
                                </span>
                                {d.finding_id && (
                                  <span className="text-[11px] font-roboto text-zinc-500">
                                    [{d.finding_id}]
                                  </span>
                                )}
                              </div>
                              {d.asset && (
                                <div className="text-xs text-zinc-400 font-roboto">
                                  Asset Target: <strong className="text-zinc-200">{d.asset}</strong>
                                </div>
                              )}
                              {d.evidence && (
                                <div className="text-xs text-zinc-300 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800/80 font-roboto">
                                  Telemetry Evidence: <span className="text-zinc-200 font-medium">{d.evidence}</span>
                                </div>
                              )}
                              {d.impact && (
                                <p className="text-xs text-zinc-400">
                                  <strong className="text-zinc-300">Impact: </strong>{d.impact}
                                </p>
                              )}
                            </div>

                            <div className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-roboto font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.12)]">
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
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
            Active scope: {domainCount} Monitored Domain(s)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
