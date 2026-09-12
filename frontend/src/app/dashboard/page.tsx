"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatsCard } from '@/components/StatsCard';
import { ExposureTable } from '@/components/ExposureTable';
import type { PillarKey } from '@/components/ScoreBreakdownModal';
import { 
  useExposureStats, 
  useExposures, 
  useDomains,
  useRiskOverview,
  useFindings
} from '@/hooks/useApi';
import { useTenant } from '@/contexts/TenantContext';
import { 
  Globe, AlertTriangle, Activity, ArrowRight, Download, Building2, 
  Network, MailCheck, Radar, KeyRound, ShieldAlert, CheckCircle2, Shield, 
  RefreshCw, Calculator, Plus, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { RiskScoreGauge } from '@/components/RiskScoreGauge';
import { 
  HeroCardSkeleton, 
  CardSkeleton, 
  FindingListSkeleton, 
  ChartSkeleton 
} from '@/components/Skeletons';

// Dynamically import heavy chart modules and modal
const ScoreBreakdownModal = dynamic(
  () => import('@/components/ScoreBreakdownModal').then(m => m.ScoreBreakdownModal),
  { ssr: false }
);

const ExposureChart = dynamic(
  () => import('@/components/ExposureChart').then(m => m.ExposureChart),
  { ssr: false, loading: () => <ChartSkeleton height="h-64" /> }
);

const SeverityDonut = dynamic(
  () => import('@/components/SeverityDonut').then(m => m.SeverityDonut),
  { ssr: false, loading: () => <ChartSkeleton height="h-64" /> }
);

export default function DashboardPage() {
  const { data: stats } = useExposureStats();
  const { data: exposures } = useExposures();
  const { data: domains, isLoading: domainsLoading } = useDomains();
  const { activeTenant, tenants, setActiveTenant } = useTenant();

  const { data: riskData, isLoading: riskLoading } = useRiskOverview();
  const { data: findings = [], isLoading: findingsLoading } = useFindings({ status: 'open', limit: 10 });

  // Score Breakdown Modal State
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<PillarKey>('overall');

  const openBreakdown = (pillar: PillarKey = 'overall') => {
    setSelectedPillar(pillar);
    setIsBreakdownOpen(true);
  };

  const isZeroDomain = !domainsLoading && (!domains || domains.length === 0);
  const isInitialLoading = domainsLoading || (riskLoading && !riskData);

  const overallScore = isZeroDomain ? 0 : (riskData?.overall_risk_score ?? 0);
  const riskLevel = isZeroDomain 
    ? 'NOT ASSESSED' 
    : (riskData?.risk_level ?? (isInitialLoading ? 'ANALYZING...' : 'NOT ASSESSED'));

  const categories = isZeroDomain ? {
    attack_surface: 0,
    email_security: 0,
    threat_intelligence: 0,
    credential_exposure: 0
  } : (riskData?.categories ?? {
    attack_surface: 0,
    email_security: 0,
    threat_intelligence: 0,
    credential_exposure: 0
  });

  const summary = isZeroDomain ? {
    discovered_assets: 0,
    open_findings: 0,
    critical_findings: 0,
    high_findings: 0,
    medium_findings: 0,
    low_findings: 0,
    exposed_identities: 0,
    email_score: 0
  } : {
    discovered_assets: riskData?.summary?.discovered_assets ?? 0,
    open_findings: findings.length,
    critical_findings: riskData?.summary?.critical_findings ?? 0,
    high_findings: riskData?.summary?.high_findings ?? 0,
    medium_findings: riskData?.summary?.medium_findings ?? 0,
    low_findings: riskData?.summary?.low_findings ?? 0,
    exposed_identities: exposures?.length ?? 0,
    email_score: riskData?.summary?.email_score ?? 0
  };



  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Score Breakdown / Why this score? Modal */}
        <ScoreBreakdownModal
          isOpen={isBreakdownOpen}
          onClose={() => setIsBreakdownOpen(false)}
          initialTab={selectedPillar}
          breakdown={riskData?.scoring_breakdown}
          overallScore={overallScore}
          riskLevel={riskLevel}
          categories={categories}
          domainCount={domains?.length ?? 0}
        />

        {/* MSP Active Scope Banner if on client tenant */}
        {activeTenant.type === 'client' && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-zinc-900/60 to-zinc-900 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5 text-indigo-300">
              <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-300">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-medium text-white">Viewing Managed Client Tenant: </span>
                <span className="font-semibold text-indigo-300 font-roboto">{activeTenant.name}</span>
                <span className="text-zinc-400 text-[11px] block sm:inline sm:ml-2">Telemetry and domain assets are isolated to this client organization.</span>
              </div>
            </div>
            <button
              onClick={() => {
                const primary = tenants.find(t => t.type === 'primary');
                if (primary) setActiveTenant(primary);
              }}
              className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              Switch to MSP Primary Console &rarr;
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">External Cyber Risk Platform</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Continuous perimeter reconnaissance, email anti-spoofing posture, and breach intelligence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => openBreakdown('overall')}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-indigo-300 border border-indigo-500/30 text-xs font-medium font-roboto transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-indigo-400" />
              <span>Scoring Breakdown</span>
            </button>
            <Link 
              href="/reports" 
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 text-xs sm:text-sm font-medium font-roboto transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </Link>
          </div>
        </div>

        {/* Zero-State Monitored Domains Banner */}
        {isZeroDomain && (
          <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900/60 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3 sm:gap-4 text-left">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 hidden sm:flex">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-white">No Monitored Domains Configured</h3>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                  Add your primary domain to initiate passive perimeter reconnaissance, certificate transparency discovery, email security audit (SPF/DMARC), and breach correlation.
                </p>
              </div>
            </div>
            <Link
              href="/domains"
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Monitored Domain</span>
            </Link>
          </div>
        )}

        {/* Top Hero Section: Unified External Cyber Risk Index */}
        <div className="p-4 sm:p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/60">
            <div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-roboto">Platform Telemetry Index</span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>External Cyber Risk Assessment</span>
              </h2>
            </div>
            {!isZeroDomain && (
              <button
                onClick={() => openBreakdown('overall')}
                className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 rounded-lg flex items-center gap-1.5 font-roboto transition-colors cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Score Breakdown &amp; Transparency</span>
              </button>
            )}
          </div>

          {/* Full-width Risk Score Gauge with explicit High/Low explanation & spectrum */}
          <div className="p-4 sm:p-5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            <RiskScoreGauge 
              score={overallScore} 
              isZeroDomain={isZeroDomain} 
              size="lg" 
              showSpectrumBar={true} 
              showExplanation={true} 
            />
          </div>

          {/* 4 Pillar Categories Section Header */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-roboto">
                Defense Posture Pillars
              </span>
              <span className="text-[11px] text-zinc-500 font-roboto">
                Higher score is better (0 = Vulnerable &bull; 100 = Optimal Defenses)
              </span>
            </div>

            {/* 4 Pillar Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Attack Surface */}
              <div className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href="/dashboard/attack-surface" className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5 transition-colors">
                      <Network className="w-4 h-4 text-zinc-400" />
                      Attack Surface
                    </Link>
                    <div className="text-right">
                      <span className="text-sm font-bold font-roboto text-zinc-200">
                        {categories.attack_surface}/100
                      </span>
                      <div className="text-[10px] text-emerald-400/80 font-roboto">Posture</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                    {summary.discovered_assets} asset(s) discovered in certificate registries and DNS.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                  <Link href="/dashboard/attack-surface" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-roboto">
                    View perimeter &rarr;
                  </Link>
                  {!isZeroDomain && (
                    <button
                      onClick={() => openBreakdown('attack_surface')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-roboto transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      Why?
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Email Security */}
              <div className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href="/dashboard/email-security" className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5 transition-colors">
                      <MailCheck className="w-4 h-4 text-zinc-400" />
                      Email Security
                    </Link>
                    <div className="text-right">
                      <span className="text-sm font-bold font-roboto text-zinc-200">
                        {categories.email_security}/100
                      </span>
                      <div className="text-[10px] text-emerald-400/80 font-roboto">Posture</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                    DMARC, SPF, and transport encryption posture.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                  <Link href="/dashboard/email-security" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-roboto">
                    Inspect policy &rarr;
                  </Link>
                  {!isZeroDomain && (
                    <button
                      onClick={() => openBreakdown('email_security')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-roboto transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      Why?
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Threat Intelligence */}
              <div className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href="/dashboard/threat-intelligence" className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5 transition-colors">
                      <Radar className="w-4 h-4 text-zinc-400" />
                      Threat Intel
                    </Link>
                    <div className="text-right">
                      <span className="text-sm font-bold font-roboto text-zinc-200">
                        {categories.threat_intelligence}/100
                      </span>
                      <div className="text-[10px] text-emerald-400/80 font-roboto">Posture</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                    Public breach index correlation &amp; reputation flags.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                  <Link href="/dashboard/threat-intelligence" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-roboto">
                    View disclosures &rarr;
                  </Link>
                  {!isZeroDomain && (
                    <button
                      onClick={() => openBreakdown('threat_intelligence')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-roboto transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      Why?
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Credential Exposure */}
              <div className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href="/exposures" className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5 transition-colors">
                      <KeyRound className="w-4 h-4 text-zinc-400" />
                      Credential Exposure
                    </Link>
                    <div className="text-right">
                      <span className="text-sm font-bold font-roboto text-zinc-200">
                        {categories.credential_exposure}/100
                      </span>
                      <div className="text-[10px] text-emerald-400/80 font-roboto">Posture</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                    {summary.exposed_identities} identity exposure(s) under active monitoring.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                  <Link href="/exposures" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-roboto">
                    View credentials &rarr;
                  </Link>
                  {!isZeroDomain && (
                    <button
                      onClick={() => openBreakdown('credential_exposure')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-roboto transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      Why?
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium font-roboto">Discovered Assets</span>
            <div className="text-2xl font-bold font-roboto text-white mt-1">{summary.discovered_assets}</div>
          </div>
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium font-roboto">Open Findings</span>
            <div className="text-2xl font-bold font-roboto text-white mt-1">{summary.open_findings}</div>
          </div>
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium font-roboto">High / Critical</span>
            <div className="text-2xl font-bold font-roboto text-orange-400 mt-1">{summary.critical_findings + summary.high_findings}</div>
          </div>
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium font-roboto">Monitored Domains</span>
            <div className="text-2xl font-bold font-roboto text-white mt-1">{domains?.length ?? 0}</div>
          </div>
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium font-roboto">Email Score</span>
            <div className="text-2xl font-bold font-roboto text-white mt-1">{summary.email_score}/100</div>
          </div>
        </div>

        {/* Prioritized Security Findings */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Prioritized Security Findings ({findings.length})
            </h2>
            <Link href="/dashboard/attack-surface" className="text-xs font-medium font-roboto text-zinc-400 hover:text-white transition-colors">
              View all &rarr;
            </Link>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {findingsLoading && !findings.length ? (
              <FindingListSkeleton count={4} />
            ) : findings.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs font-roboto">
                No active security findings detected across monitored perimeter.
              </div>
            ) : (
              findings.slice(0, 5).map((f: any) => {
                const getBadge = (sev: string) => {
                  switch (sev?.toLowerCase()) {
                    case 'critical':
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-rose-500/10 text-rose-300 border border-rose-500/35 shadow-[0_0_10px_rgba(244,63,94,0.18)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          CRITICAL
                        </span>
                      );
                    case 'high':
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-orange-500/10 text-orange-300 border border-orange-500/35 shadow-[0_0_10px_rgba(249,115,22,0.18)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                          HIGH
                        </span>
                      );
                    case 'medium':
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-amber-500/10 text-amber-300 border border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.18)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          MEDIUM
                        </span>
                      );
                    default:
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-roboto bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          LOW
                        </span>
                      );
                  }
                };

                return (
                  <div key={f.id} className="p-4 hover:bg-zinc-800/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-roboto">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {getBadge(f.severity)}
                        <span className="text-sm font-semibold text-white">
                          {f.title}
                        </span>
                        <span className="text-xs font-medium font-roboto text-zinc-400">
                          {f.finding_id}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-roboto">
                        {f.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-roboto text-zinc-300">
                        {f.asset}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Credential Exposure & Activity Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4 flex items-center justify-between">
              <span>Historical Threat Exposure Ingestion</span>
              <span className="text-xs font-medium font-roboto text-zinc-400">Chronological telemetry</span>
            </h2>
            <div className="h-64 sm:h-72 w-full">
              <ExposureChart />
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4">
              Severity Distribution
            </h2>
            <div className="h-64 sm:h-72 w-full flex items-center justify-center">
              <SeverityDonut data={stats} />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
