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
import { SeverityBadge } from '@/components/SeverityBadge';
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
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-zinc-300">
              <div className="p-1.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-medium text-zinc-100">Viewing Managed Client Tenant: </span>
                <span className="font-semibold text-zinc-200 font-mono">{activeTenant.name}</span>
                <span className="text-zinc-400 text-[11px] block sm:inline sm:ml-2">Telemetry and domain assets are isolated to this client organization.</span>
              </div>
            </div>
            <button
              onClick={() => {
                const primary = tenants.find(t => t.type === 'primary');
                if (primary) setActiveTenant(primary);
              }}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              Switch to MSP Primary Console &rarr;
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">External Cyber Risk Platform</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Continuous perimeter reconnaissance, email anti-spoofing posture, and breach intelligence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => openBreakdown('overall')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-zinc-400" />
              <span>Scoring Breakdown</span>
            </button>
            <Link 
              href="/reports" 
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </Link>
          </div>
        </div>

        {/* Zero-State Monitored Domains Banner */}
        {isZeroDomain && (
          <div className="p-4 sm:p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 text-left">
              <div className="p-2.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0 hidden sm:flex">
                <Globe className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-100">No Monitored Domains Configured</h3>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                  Add your primary domain to initiate passive perimeter reconnaissance, certificate transparency discovery, email security audit (SPF/DMARC), and breach correlation.
                </p>
              </div>
            </div>
            <Link
              href="/domains"
              className="w-full sm:w-auto px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Configure Monitored Domain</span>
            </Link>
          </div>
        )}

        {/* Risk Score Assessment Panel */}
        <div className="p-4 sm:p-5 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            <div>
              <span className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider">Platform Telemetry Index</span>
              <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
                External Cyber Risk Assessment
              </h2>
            </div>
            {!isZeroDomain && (
              <button
                onClick={() => openBreakdown('overall')}
                className="self-start sm:self-auto px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-zinc-400" />
                <span>Score Breakdown &amp; Transparency</span>
              </button>
            )}
          </div>

          <RiskScoreGauge 
            score={overallScore} 
            isZeroDomain={isZeroDomain} 
            size="lg" 
            showSpectrumBar={true} 
            showExplanation={true} 
          />
        </div>

        {/* Defense Posture Pillars */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Defense Posture Pillars
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">
              Higher score is better (0 = Vulnerable &bull; 100 = Optimal Defenses)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Attack Surface */}
            <div className="p-3.5 bg-zinc-900/50 hover:bg-zinc-850/50 border border-zinc-800 rounded-lg space-y-3 transition-colors flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Link href="/dashboard/attack-surface" className="text-sm font-medium text-zinc-200 group-hover:text-white flex items-center gap-2 transition-colors">
                    <Network className="w-4 h-4 text-zinc-400" />
                    Attack Surface
                  </Link>
                  <div className="text-right">
                    <span className="text-sm font-semibold font-mono text-zinc-200">
                      {categories.attack_surface}<span className="text-zinc-500 text-xs font-normal">/100</span>
                    </span>
                    <div className="text-[10px] text-zinc-400 font-mono">Posture</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                  {summary.discovered_assets} asset(s) discovered in certificate registries and DNS.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <Link href="/dashboard/attack-surface" className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors">
                  View perimeter &rarr;
                </Link>
                {!isZeroDomain && (
                  <button
                    onClick={() => openBreakdown('attack_surface')}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3 h-3 text-zinc-500" />
                    Why?
                  </button>
                )}
              </div>
            </div>

            {/* 2. Email Security */}
            <div className="p-3.5 bg-zinc-900/50 hover:bg-zinc-850/50 border border-zinc-800 rounded-lg space-y-3 transition-colors flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Link href="/dashboard/email-security" className="text-sm font-medium text-zinc-200 group-hover:text-white flex items-center gap-2 transition-colors">
                    <MailCheck className="w-4 h-4 text-zinc-400" />
                    Email Security
                  </Link>
                  <div className="text-right">
                    <span className="text-sm font-semibold font-mono text-zinc-200">
                      {categories.email_security}<span className="text-zinc-500 text-xs font-normal">/100</span>
                    </span>
                    <div className="text-[10px] text-zinc-400 font-mono">Posture</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                  DMARC, SPF, and transport encryption posture.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <Link href="/dashboard/email-security" className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors">
                  Inspect policy &rarr;
                </Link>
                {!isZeroDomain && (
                  <button
                    onClick={() => openBreakdown('email_security')}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3 h-3 text-zinc-500" />
                    Why?
                  </button>
                )}
              </div>
            </div>

            {/* 3. Threat Intelligence */}
            <div className="p-3.5 bg-zinc-900/50 hover:bg-zinc-850/50 border border-zinc-800 rounded-lg space-y-3 transition-colors flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Link href="/dashboard/threat-intelligence" className="text-sm font-medium text-zinc-200 group-hover:text-white flex items-center gap-2 transition-colors">
                    <Radar className="w-4 h-4 text-zinc-400" />
                    Threat Intel
                  </Link>
                  <div className="text-right">
                    <span className="text-sm font-semibold font-mono text-zinc-200">
                      {categories.threat_intelligence}<span className="text-zinc-500 text-xs font-normal">/100</span>
                    </span>
                    <div className="text-[10px] text-zinc-400 font-mono">Posture</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                  Public breach index correlation &amp; reputation flags.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <Link href="/dashboard/threat-intelligence" className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors">
                  View disclosures &rarr;
                </Link>
                {!isZeroDomain && (
                  <button
                    onClick={() => openBreakdown('threat_intelligence')}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3 h-3 text-zinc-500" />
                    Why?
                  </button>
                )}
              </div>
            </div>

            {/* 4. Credential Exposure */}
            <div className="p-3.5 bg-zinc-900/50 hover:bg-zinc-850/50 border border-zinc-800 rounded-lg space-y-3 transition-colors flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Link href="/exposures" className="text-sm font-medium text-zinc-200 group-hover:text-white flex items-center gap-2 transition-colors">
                    <KeyRound className="w-4 h-4 text-zinc-400" />
                    Credential Exposure
                  </Link>
                  <div className="text-right">
                    <span className="text-sm font-semibold font-mono text-zinc-200">
                      {categories.credential_exposure}<span className="text-zinc-500 text-xs font-normal">/100</span>
                    </span>
                    <div className="text-[10px] text-zinc-400 font-mono">Posture</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                  {summary.exposed_identities} identity exposure(s) under active monitoring.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <Link href="/exposures" className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors">
                  View credentials &rarr;
                </Link>
                {!isZeroDomain && (
                  <button
                    onClick={() => openBreakdown('credential_exposure')}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3 h-3 text-zinc-500" />
                    Why?
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <span className="text-xs text-zinc-400 font-medium">Discovered Assets</span>
            <div className="text-xl sm:text-2xl font-semibold font-mono text-zinc-100 mt-1">{summary.discovered_assets}</div>
          </div>
          <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <span className="text-xs text-zinc-400 font-medium">Open Findings</span>
            <div className="text-xl sm:text-2xl font-semibold font-mono text-zinc-100 mt-1">{summary.open_findings}</div>
          </div>
          <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <span className="text-xs text-zinc-400 font-medium">High / Critical</span>
            <div className="text-xl sm:text-2xl font-semibold font-mono text-amber-400 mt-1">{summary.critical_findings + summary.high_findings}</div>
          </div>
          <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <span className="text-xs text-zinc-400 font-medium">Monitored Domains</span>
            <div className="text-xl sm:text-2xl font-semibold font-mono text-zinc-100 mt-1">{domains?.length ?? 0}</div>
          </div>
          <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <span className="text-xs text-zinc-400 font-medium">Email Score</span>
            <div className="text-xl sm:text-2xl font-semibold font-mono text-zinc-100 mt-1">{summary.email_score}<span className="text-xs text-zinc-500 font-normal font-sans">/100</span></div>
          </div>
        </div>

        {/* Prioritized Security Findings */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2 font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
              Prioritized Security Findings ({findings.length})
            </h2>
            <Link href="/dashboard/attack-surface" className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors">
              View all &rarr;
            </Link>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {findingsLoading && !findings.length ? (
              <FindingListSkeleton count={4} />
            ) : findings.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs font-mono">
                No active security findings detected across monitored perimeter.
              </div>
            ) : (
              findings.slice(0, 5).map((f: any) => {
                return (
                  <div key={f.id} className="p-3.5 sm:px-4 sm:py-3 hover:bg-zinc-850/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-xs sm:text-sm font-medium text-zinc-100">
                          {f.title}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          [{f.finding_id}]
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-normal leading-relaxed">
                        {f.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-zinc-300">
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
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4 flex items-center justify-between font-mono">
              <span>Historical Threat Exposure Ingestion</span>
              <span className="text-xs font-normal text-zinc-500">Chronological telemetry</span>
            </h2>
            <div className="h-64 sm:h-72 w-full">
              <ExposureChart />
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4 font-mono">
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
