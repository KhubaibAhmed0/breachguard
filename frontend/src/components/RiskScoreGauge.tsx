"use client";

import React from 'react';
import { Shield, ShieldAlert, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RiskTierInfo {
  level: string;
  label: string;
  description: string;
  badgeClass: string;
  textClass: string;
  barColor: string;
  recommendation: string;
}

export function getRiskTier(score: number, isZeroDomain: boolean = false): RiskTierInfo {
  if (isZeroDomain) {
    return {
      level: 'NOT ASSESSED',
      label: 'Not Assessed',
      description: 'Add a monitored domain to calculate risk',
      badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-750',
      textClass: 'text-zinc-500',
      barColor: 'bg-zinc-750',
      recommendation: 'Configure your primary domain to initiate passive external security reconnaissance.'
    };
  }

  if (score >= 75) {
    return {
      level: 'CRITICAL RISK',
      label: 'Critical Risk',
      description: 'Severe external perimeter exposures detected',
      badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
      textClass: 'text-rose-400',
      barColor: 'bg-rose-500',
      recommendation: 'Immediate action required. Exposed administrative services or botnet-exfiltrated credentials require immediate containment.'
    };
  }

  if (score >= 60) {
    return {
      level: 'HIGH RISK',
      label: 'High Risk',
      description: 'Elevated threat posture requiring attention',
      badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.2)]',
      textClass: 'text-orange-400',
      barColor: 'bg-orange-500',
      recommendation: 'Active attention recommended. High-severity CVEs, multiple breach exposures, or missing email security policies identified.'
    };
  }

  if (score >= 35) {
    return {
      level: 'MEDIUM RISK',
      label: 'Medium Risk',
      description: 'Moderate exposure — perimeter improvements advised',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
      textClass: 'text-amber-400',
      barColor: 'bg-amber-500',
      recommendation: 'Preventative hardening advised. Enable DMARC enforcement (p=reject) and close unnecessary public subdomains.'
    };
  }

  return {
    level: 'LOW RISK',
    label: 'Low Risk',
    description: 'Perimeter is secure with strong defenses',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    textClass: 'text-emerald-400',
    barColor: 'bg-emerald-500',
    recommendation: 'Excellent security posture. Maintain automated continuous monitoring to prevent future drift.'
  };
}

interface RiskScoreGaugeProps {
  score: number;
  isZeroDomain?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showSpectrumBar?: boolean;
  showExplanation?: boolean;
  className?: string;
}

export function RiskScoreGauge({
  score,
  isZeroDomain = false,
  size = 'md',
  showSpectrumBar = true,
  showExplanation = true,
  className
}: RiskScoreGaugeProps) {
  const tier = getRiskTier(score, isZeroDomain);
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Top Value & Badge Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              "font-extrabold font-roboto tracking-tight",
              tier.textClass,
              size === 'lg' ? "text-4xl sm:text-5xl" : size === 'md' ? "text-3xl sm:text-4xl" : "text-2xl"
            )}>
              {isZeroDomain ? 0 : clampedScore}
            </span>
            <span className="text-xs text-zinc-500 font-roboto">/ 100 Risk Index</span>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1 font-roboto mt-0.5">
            <span className="font-semibold text-zinc-300">Lower score is safer</span>
            <span>(0 = Pristine &bull; 100 = Critical Risk)</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-roboto font-semibold uppercase border tracking-wider", tier.badgeClass)}>
            {tier.level}
          </span>
          <span className="text-[10px] text-zinc-400 font-roboto">
            {tier.description}
          </span>
        </div>
      </div>

      {/* Segmented Risk Spectrum Bar */}
      {showSpectrumBar && !isZeroDomain && (
        <div className="space-y-1.5 pt-1">
          {/* Bar track with 4 colored zones */}
          <div className="relative h-2.5 w-full bg-zinc-950 rounded-full overflow-visible border border-zinc-800">
            {/* Zone fills */}
            <div className="absolute inset-0 flex rounded-full overflow-hidden">
              <div className="w-[35%] bg-emerald-500/30 border-r border-zinc-900" title="Low Risk: 0-34" />
              <div className="w-[25%] bg-amber-500/30 border-r border-zinc-900" title="Medium Risk: 35-59" />
              <div className="w-[15%] bg-orange-500/30 border-r border-zinc-900" title="High Risk: 60-74" />
              <div className="w-[25%] bg-rose-500/30" title="Critical Risk: 75-100" />
            </div>

            {/* Current Score Indicator Pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none"
              style={{ left: `${clampedScore}%` }}
            >
              <div className={cn(
                "w-4 h-4 rounded-full border-2 border-zinc-950 shadow-lg ring-2 transition-all",
                tier.barColor,
                score >= 75 ? "ring-rose-500/50" : score >= 60 ? "ring-orange-500/50" : score >= 35 ? "ring-amber-500/50" : "ring-emerald-500/50"
              )} />
            </div>
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between text-[10px] font-roboto px-0.5">
            <span className="text-emerald-400 font-medium">0 Low (0-34)</span>
            <span className="text-amber-400 font-medium">Medium (35-59)</span>
            <span className="text-orange-400 font-medium">High (60-74)</span>
            <span className="text-rose-400 font-medium">Critical (75-100)</span>
          </div>
        </div>
      )}

      {/* Plain-English Recommendation Text */}
      {showExplanation && !isZeroDomain && (
        <p className="text-xs text-zinc-400 font-roboto leading-relaxed bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
          <strong className="text-zinc-200">Verdict: </strong>
          {tier.recommendation}
        </p>
      )}
    </div>
  );
}