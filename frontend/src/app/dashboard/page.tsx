"use client";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatsCard } from '@/components/StatsCard';
import { ExposureChart } from '@/components/ExposureChart';
import { SeverityDonut } from '@/components/SeverityDonut';
import { ExposureTable } from '@/components/ExposureTable';
import { useExposureStats, useExposures, useDomains } from '@/hooks/useApi';
import { useTenant } from '@/contexts/TenantContext';
import { 
  Globe, AlertTriangle, Activity, ArrowRight, Download, Building2, 
  Network, MailCheck, Radar, KeyRound, ShieldAlert, CheckCircle2, Shield, RefreshCw 
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

export default function DashboardPage() {
  const { data: stats } = useExposureStats();
  const { data: exposures } = useExposures();
  const { data: domains } = useDomains();
  const { activeTenant, tenants, setActiveTenant } = useTenant();

  const [riskData, setRiskData] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadOverview = async () => {
    try {
      const [resRisk, resFindings] = await Promise.all([
        api.get('/risk/overview'),
        api.get('/findings?status=open')
      ]);
      setRiskData(resRisk.data || null);
      setFindings(resFindings.data || []);
    } catch (err) {
      console.error('Failed to load risk overview', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const overallScore = riskData?.overall_risk_score ?? 25;
  const riskLevel = riskData?.risk_level ?? 'LOW RISK';
  const categories = riskData?.categories ?? {
    attack_surface: 95,
    email_security: 80,
    threat_intelligence: 90,
    credential_exposure: 90
  };
  const summary = riskData?.summary ?? {
    discovered_assets: 1,
    open_findings: findings.length,
    critical_findings: 0,
    high_findings: 0,
    medium_findings: 0,
    low_findings: 0,
    exposed_identities: exposures?.length ?? 0,
    email_score: 80
  };

  const riskColor = 
    overallScore >= 65 ? 'text-red-400' :
    overallScore >= 40 ? 'text-orange-400' :
    'text-emerald-400';

  const riskBadgeBg = 
    overallScore >= 65 ? 'bg-red-950/60 border-red-800/60 text-red-400' :
    overallScore >= 40 ? 'bg-orange-950/60 border-orange-800/60 text-orange-400' :
    'bg-emerald-950/60 border-emerald-800/60 text-emerald-400';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* MSP Active Scope Banner if on client tenant */}
        {activeTenant.type === 'client' && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-zinc-900/60 to-zinc-900 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5 text-indigo-300">
              <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-300">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-medium text-white">Viewing Managed Client Tenant: </span>
                <span className="font-semibold text-indigo-300 font-mono">{activeTenant.name}</span>
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
          <div className="flex items-center gap-2.5">
            <Link 
              href="/reports" 
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 text-sm font-medium font-roboto transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export Assessment PDF
            </Link>
          </div>
        </div>

        {/* Top Hero Section: Unified External Cyber Risk Index */}
        <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/60">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-roboto">Platform Telemetry Index</span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-3">
                External Cyber Risk Score
                <span className={`text-xs px-3 py-1 rounded-full font-roboto uppercase font-semibold border ${riskBadgeBg}`}>
                  {riskLevel}
                </span>
              </h2>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed font-roboto">
                Deterministic risk score derived across your public attack surface, email security configuration, threat intelligence records, and credential exposure.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-zinc-950/60 p-4 border border-zinc-800/80 rounded-xl shrink-0">
              <div className="text-center">
                <div className={`text-4xl font-extrabold font-roboto ${riskColor}`}>
                  {overallScore}
                  <span className="text-base font-normal text-zinc-500 font-roboto"> / 100</span>
                </div>
                <div className="text-xs font-medium uppercase text-zinc-400 mt-1 font-roboto">
                  Overall Risk Rating
                </div>
              </div>
            </div>
          </div>

          {/* 4 Pillar Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Attack Surface */}
            <Link href="/dashboard/attack-surface" className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-zinc-400" />
                  Attack Surface
                </span>
                <span className="text-sm font-bold font-roboto text-zinc-200">
                  {categories.attack_surface}/100
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                {summary.discovered_assets} asset(s) discovered in certificate registries and DNS.
              </p>
              <div className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1 pt-1 font-roboto">
                View perimeter &rarr;
              </div>
            </Link>

            {/* 2. Email Security */}
            <Link href="/dashboard/email-security" className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5">
                  <MailCheck className="w-4 h-4 text-zinc-400" />
                  Email Security
                </span>
                <span className="text-sm font-bold font-roboto text-zinc-200">
                  {categories.email_security}/100
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                DMARC, SPF, and transport encryption posture.
              </p>
              <div className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1 pt-1 font-roboto">
                Inspect anti-spoofing &rarr;
              </div>
            </Link>

            {/* 3. Threat Intelligence */}
            <Link href="/dashboard/threat-intelligence" className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5">
                  <Radar className="w-4 h-4 text-zinc-400" />
                  Threat Intel
                </span>
                <span className="text-sm font-bold font-roboto text-zinc-200">
                  {categories.threat_intelligence}/100
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                Public breach index correlation & reputation flags.
              </p>
              <div className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1 pt-1 font-roboto">
                View disclosures &rarr;
              </div>
            </Link>

            {/* 4. Credential Exposure */}
            <Link href="/exposures" className="p-4 bg-zinc-950/40 hover:bg-zinc-800/20 border border-zinc-800/80 rounded-xl space-y-2 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-zinc-400" />
                  Credential Exposure
                </span>
                <span className="text-sm font-bold font-roboto text-zinc-200">
                  {categories.credential_exposure}/100
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-roboto leading-relaxed">
                {summary.exposed_identities} identity exposure(s) under active monitoring.
              </p>
              <div className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1 pt-1 font-roboto">
                View credentials &rarr;
              </div>
            </Link>
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
            {loadingOverview ? (
              <div className="py-8 text-center text-zinc-500 text-xs font-roboto">Loading findings...</div>
            ) : findings.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs font-roboto">
                No active security findings detected across monitored perimeter.
              </div>
            ) : (
              findings.slice(0, 5).map((f) => {
                const sevColor = 
                  f.severity === 'critical' ? 'bg-red-950/60 text-red-400 border-red-800/60' :
                  f.severity === 'high' ? 'bg-orange-950/60 text-orange-400 border-orange-800/60' :
                  f.severity === 'medium' ? 'bg-amber-950/60 text-amber-400 border-amber-800/60' :
                  'bg-zinc-800 text-zinc-400 border-zinc-700';

                return (
                  <div key={f.id} className="p-4 hover:bg-zinc-800/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-roboto">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-roboto uppercase font-semibold border ${sevColor}`}>
                          {f.severity}
                        </span>
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
              <span className="text-xs font-medium font-roboto text-zinc-400">Last 30 days telemetry</span>
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
              <SeverityDonut />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
