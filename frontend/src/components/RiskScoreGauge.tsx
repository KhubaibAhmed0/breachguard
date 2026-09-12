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
      badgeClass: 'bg-bg-inset text-text-muted border-border-default',
      textClass: 'text-text-muted',
      barColor: 'bg-border-strong',
      recommendation: 'Configure your primary domain to initiate passive external security reconnaissance.'
    };
  }

  if (score >= 75) {
    return {
      level: 'CRITICAL RISK',
      label: 'Critical Risk',
      description: 'Severe external perimeter exposures detected',
      badgeClass: 'bg-red-500/8 text-red-300 border-red-500/20',
      textClass: 'text-red-400',
      barColor: 'bg-red-500',
      recommendation: 'Immediate action required. Exposed administrative services or botnet-exfiltrated credentials require immediate containment.'
    };
  }

  if (score >= 60) {
    return {
      level: 'HIGH RISK',
      label: 'High Risk',
      description: 'Elevated threat posture requiring attention',
      badgeClass: 'bg-orange-500/8 text-orange-300 border-orange-500/20',
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
      badgeClass: 'bg-yellow-500/8 text-yellow-300 border-yellow-500/20',
      textClass: 'text-yellow-400',
      barColor: 'bg-yellow-500',
      recommendation: 'Preventative hardening advised. Enable DMARC enforcement (p=reject) and close unnecessary public subdomains.'
    };
  }

  return {
    level: 'LOW RISK',
    label: 'Low Risk',
    description: 'Perimeter is secure with strong defenses',
    badgeClass: 'bg-green-500/8 text-green-300 border-green-500/20',
    textClass: 'text-green-400',
    barColor: 'bg-green-500',
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
    <div className={cn("space-y-4", className)}>
      {/* Top Value & Badge Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "font-bold font-mono tracking-tight",
              tier.textClass,
              size === 'lg' ? "text-3xl sm:text-4xl" : size === 'md' ? "text-2xl sm:text-3xl" : "text-xl"
            )}>
              {isZeroDomain ? 0 : clampedScore}
            </span>
            <span className="text-xs text-text-muted font-mono">/ 100 Risk Index</span>
          </div>
          <div className="text-2xs text-text-muted flex items-center gap-1 mt-1">
            <span className="text-text-secondary font-medium">Lower score is safer</span>
            <span className="text-text-faint">&bull; 0 = Pristine &bull; 100 = Critical Exposure</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium uppercase tracking-wide border", tier.badgeClass)}>
            {tier.level}
          </span>
          <span className="text-2xs text-text-faint">
            {tier.description}
          </span>
        </div>
      </div>

      {/* Segmented Risk Spectrum Bar */}
      {showSpectrumBar && !isZeroDomain && (
        <div className="space-y-1.5 pt-1">
          {/* Bar track with 4 colored zones */}
          <div className="relative h-2 w-full bg-bg-base rounded-sm overflow-visible border border-border-default">
            {/* Zone fills */}
            <div className="absolute inset-0 flex rounded-sm overflow-hidden">
              <div className="w-[35%] bg-green-500/15 border-r border-border-default" title="Low Risk: 0-34" />
              <div className="w-[25%] bg-yellow-500/15 border-r border-border-default" title="Medium Risk: 35-59" />
              <div className="w-[15%] bg-orange-500/15 border-r border-border-default" title="High Risk: 60-74" />
              <div className="w-[25%] bg-red-500/15" title="Critical Risk: 75-100" />
            </div>

            {/* Current Score Indicator Pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none"
              style={{ left: `${clampedScore}%` }}
            >
              <div className={cn(
                "w-3 h-3 rounded-full border border-bg-base transition-all",
                tier.barColor
              )} />
            </div>
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between text-2xs font-mono text-text-faint px-0.5">
            <span className="text-green-400">0 Low (0-34)</span>
            <span className="text-yellow-400">Medium (35-59)</span>
            <span className="text-orange-400">High (60-74)</span>
            <span className="text-red-400">Critical (75-100)</span>
          </div>
        </div>
      )}

      {/* Plain-English Recommendation Text */}
      {showExplanation && !isZeroDomain && (
        <div className="text-xs text-text-muted leading-relaxed pt-2 border-t border-border-default">
          <span className="text-text-secondary font-medium">Verdict: </span>
          <span>{tier.recommendation}</span>
        </div>
      )}
    </div>
  );
}