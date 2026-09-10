"use client";

import { DashboardLayout } from '@/components/DashboardLayout';
import { RiskScoreGauge } from '@/components/RiskScoreGauge';
import { StatsCard } from '@/components/StatsCard';
import { ExposureChart } from '@/components/ExposureChart';
import { SeverityDonut } from '@/components/SeverityDonut';
import { ExposureTable } from '@/components/ExposureTable';
import { useExposureStats, useExposures, useDomains } from '@/hooks/useApi';
import { useTenant } from '@/contexts/TenantContext';
import { Globe, AlertTriangle, Activity, ArrowRight, Download, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: stats } = useExposureStats();
  const { data: exposures } = useExposures();
  const { data: domains } = useDomains();
  const { activeTenant, tenants, setActiveTenant } = useTenant();

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
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Security Overview</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Active identity exposure and dark web monitoring telemetry across your perimeter.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link 
              href="/reports" 
              className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF report
            </Link>
          </div>
        </div>

        {/* Row 1 - Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col items-center justify-center">
            <span className="text-xs font-medium text-zinc-400 mb-2">Posture score</span>
            <RiskScoreGauge score={stats?.riskScore ?? 100} />
          </div>

          <StatsCard 
            title="Total exposures" 
            value={stats?.total ?? 0} 
            icon={Activity} 
            trend={stats?.trend || 'flat'} 
            description="Across all indexed databases"
          />

          <StatsCard 
            title="Critical findings" 
            value={stats?.critical ?? 0} 
            icon={AlertTriangle} 
            color="text-amber-400"
            description="Plaintext passwords or stealer logs"
          />

          <StatsCard 
            title="Monitored domains" 
            value={domains?.length ?? 0} 
            icon={Globe} 
            description="Active perimeter endpoints"
          />
        </div>

        {/* Row 2 - Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Exposure discovery timeline</h3>
                <p className="text-xs text-zinc-500">Historical credential discoveries over the last 12 months</p>
              </div>
            </div>
            <div className="h-64">
              <ExposureChart />
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">Severity breakdown</h3>
              <p className="text-xs text-zinc-500">Distribution by threat severity level</p>
            </div>
            <div className="h-64">
              <SeverityDonut data={stats} />
            </div>
          </div>
        </div>

        {/* Row 3 - Recent Exposures */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent threat discoveries</h3>
              <p className="text-xs text-zinc-500">Latest leaked corporate credentials requiring remediation</p>
            </div>
            <Link href="/exposures" className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              View all inventory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <ExposureTable data={exposures?.slice(0, 5) || []} />
        </div>
      </div>
    </DashboardLayout>
  );
}