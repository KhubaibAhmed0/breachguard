"use client";

import { ScanInput, ScanResultData } from '@/components/ScanInput';
import { PricingCard } from '@/components/PricingCard';
import { InvoiceRequestModal } from '@/components/InvoiceRequestModal';
import { 
  Shield, FileText, CheckCircle2, ArrowRight, Database, 
  Lock, Check, AlertCircle, ShieldCheck, X, Network, MailCheck, Radar, KeyRound, Globe, Server
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function LandingPage() {
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoicePlan, setInvoicePlan] = useState<'business' | 'enterprise'>('enterprise');

  const overallScore = scanResult?.overall_risk_score ?? 15;
  const riskLevel = scanResult?.risk_level ?? 'LOW RISK';
  const riskBadgeBg = 
    overallScore >= 65 ? 'bg-rose-500/10 border-rose-500/35 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.18)]' :
    overallScore >= 40 ? 'bg-orange-500/10 border-orange-500/35 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.18)]' :
    'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.14)]';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-zinc-100">
      
      {/* Navigation */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Shield className="w-4 h-4 text-zinc-100" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">
              BreachGuard
            </span>
          </div>

          <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
            <a href="#features" className="hover:text-zinc-200 transition-colors">Pillars</a>
            <a href="#compliance" className="hover:text-zinc-200 transition-colors">Architecture</a>
            <a href="#pricing" className="hover:text-zinc-200 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 transition-colors">
              Log in
            </Link>
            <Link href="/register" className="text-xs font-medium px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-4 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 text-xs mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            External Cyber Risk &amp; Perimeter Monitoring &bull; 7-day free trial
          </div>

          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white leading-tight mb-6">
            External cyber risk &amp; perimeter monitoring for modern organizations.
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Discover exposed assets, identify email security weaknesses, monitor public threat intelligence, and track credential exposure from a single unified platform.
          </p>

          <ScanInput onScanComplete={(data) => setScanResult(data)} />

          <p className="mt-4 text-xs text-zinc-500">
            Non-intrusive external reconnaissance. Zero configuration required &bull; 7-day free trial.
          </p>
        </section>

        {/* Scan Results Panel — External Risk Snapshot */}
        {scanResult && (
          <section className="py-10 px-4 max-w-4xl mx-auto">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-roboto mb-1">
                    External Cyber Risk Snapshot
                  </div>
                  <h2 className="text-2xl font-semibold text-white tracking-tight">
                    {scanResult.domain}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold font-roboto text-white">
                      {overallScore} <span className="text-xs text-zinc-500 font-normal">/ 100</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-roboto uppercase font-semibold border ${riskBadgeBg}`}>
                      {riskLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Pillars Snapshot Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-zinc-400" />
                    Attack Surface
                  </div>
                  <div className="text-xl font-semibold text-zinc-100">{scanResult.discovered_assets_count ?? 1}</div>
                  <div className="text-[11px] text-zinc-500">Discovered subdomains</div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <MailCheck className="w-3.5 h-3.5 text-zinc-400" />
                    Email Security
                  </div>
                  <div className="text-xl font-semibold text-zinc-100">{scanResult.email_security_score ?? 60}/100</div>
                  <div className="text-[11px] text-zinc-500">SPF &amp; DMARC audit</div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Radar className="w-3.5 h-3.5 text-zinc-400" />
                    Threat Intel
                  </div>
                  <div className="text-xl font-semibold text-zinc-100">{scanResult.breach_count}</div>
                  <div className="text-[11px] text-zinc-500">Public breach archives</div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                    Identities
                  </div>
                  <div className="text-xl font-semibold text-zinc-100">{scanResult.total_exposures}</div>
                  <div className="text-[11px] text-zinc-500">Exposures monitored</div>
                </div>
              </div>

              {/* Sample Observed Findings */}
              {scanResult.sample_findings && scanResult.sample_findings.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-zinc-400">Sample Observed Findings:</div>
                  <div className="space-y-2">
                    {scanResult.sample_findings.map((finding, idx) => (
                      <div key={idx} className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{finding.title}</span>
                        </div>
                        <span className="text-zinc-500 font-roboto text-[11px]">{finding.evidence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Confirmation Banner when no exposures found */}
              {scanResult.total_exposures === 0 && (!scanResult.sample_findings || scanResult.sample_findings.length === 0) && (
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
                  <Check className="w-4 h-4 text-zinc-300 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Scan completed — no exposure detected</div>
                    <div className="text-xs text-zinc-400 mt-0.5">No exposed corporate accounts, open administrative services, or security weaknesses were detected for this target.</div>
                  </div>
                </div>
              )}

              {/* Conversion Box */}
              <div className="p-5 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {scanResult.conversion_title || 'Get the complete security assessment & remediation report'}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      The paid product provides continuous perimeter auditing, change detection, and 10–15 page audit-ready PDF reports.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Link 
                      href="/login" 
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium transition-colors"
                    >
                      Log in
                    </Link>
                    <Link 
                      href="/register" 
                      className="px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      Start 7-day trial <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-300" /> Continuous attack surface &amp; port monitoring</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-300" /> Actionable DMARC/SPF technical guidance</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-300" /> 10–15 page executive &amp; compliance PDF reports</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-300" /> Automated alerts for newly exposed services</div>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Security Architecture Alignment */}
        <section id="compliance" className="py-16 border-y border-zinc-900 bg-zinc-900/20">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-4">
              Security architecture aligned with industry standards
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-sm text-zinc-400 font-medium">
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-zinc-400" /> SOC 2 Aligned Controls</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-zinc-400" /> ISO 27001 Control Mapping</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-zinc-400" /> Cyber Insurance Due-Diligence Ready</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-zinc-400" /> NIST CSF Aligned</span>
            </div>
          </div>
        </section>

        {/* Platform Capabilities (4 Pillars) */}
        <section id="features" className="py-24 px-4 max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
              One coherent cybersecurity platform, not unrelated scanners.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl">
              Evaluate your external perimeter from all four critical angles to eliminate blind spots.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Pillar 1 */}
            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-200">
                <Network className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">External Attack Surface</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Discover publicly observable subdomains, resolved IP addresses, and listening network services via Certificate Transparency and passive Shodan InternetDB intelligence without invasive network scanning.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-200">
                <MailCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">Email Security &amp; Anti-Spoofing</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Assess SPF records, DMARC enforcement policies (p=reject / p=quarantine), discoverable DKIM keys, and transport encryption controls to prevent executive impersonation and wire fraud.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-200">
                <Radar className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">Public Threat Intelligence</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Monitor public breach disclosures and security vendor reputation flags. Every finding provides verifiable source provenance and confidence ratings.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-200">
                <KeyRound className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white">Credential Exposure Monitoring</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Track compromised corporate identity exposures across leak indexes and infostealer malware logs while preserving zero-credential persistence to protect user privacy.
              </p>
            </div>
          </div>

          {/* Feature 5: Reports */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <h3 className="text-base font-semibold text-white">10–15 Page Executive &amp; Compliance Assessments</h3>
              </div>
              <p className="text-xs text-zinc-400 max-w-xl">
                Generate structured, publication-grade PDF reports complete with prioritized 0-24h remediation roadmaps, methodology disclosures, and technical verification steps.
              </p>
            </div>
            <Link href="/register" className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0">
              Generate Sample Report &rarr;
            </Link>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 max-w-5xl mx-auto border-t border-zinc-900">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-2">
              Straightforward subscription pricing
            </h2>
            <p className="text-sm text-zinc-400">Predictable monthly billing with no annual lock-in.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <PricingCard 
              title="Essential" 
              price="$99" 
              description="External perimeter reconnaissance and email posture auditing for small teams."
              features={[
                '1 monitored domain',
                '5 privileged identities',
                'Attack surface & subdomain discovery',
                'SPF & DMARC posture auditing',
                'Public breach & leak correlation',
                'Email notification alerts',
                'Standard executive reports',
                '90 days telemetry retention'
              ]}
              ctaText="Start with Essential"
              subtext="Cancel or upgrade anytime"
            />
            <PricingCard 
              title="Business" 
              price="$239" 
              badge="MOST POPULAR"
              description="Continuous external cyber risk monitoring for growing organizations."
              features={[
                '3 monitored domains',
                '25 privileged identities',
                'Continuous attack surface auditing',
                'Full infostealer & threat intelligence',
                'DMARC & email security monitoring',
                'Email + Slack + SIEM alerts',
                '10–15 page audit-ready PDF reports',
                '1 year telemetry retention'
              ]}
              isPopular
              ctaText="Start 7-Day Free Trial"
              subtext="No credit card required • Instant access"
            />
            <PricingCard 
              title="Enterprise / MSP" 
              price="$899" 
              description="Multi-tenant external risk management for service providers and enterprises."
              features={[
                'Unlimited monitored domains',
                'Multi-tenant child client portals',
                'Full co-branded PDF report generation',
                'Rest API & webhook integrations',
                'Automated scheduled recurring scans',
                'Unlimited telemetry retention',
                'Dedicated compliance support'
              ]}
              ctaText="Request Enterprise Invoice"
              onCtaClick={() => {
                setInvoicePlan('enterprise');
                setIsInvoiceModalOpen(true);
              }}
              subtext="Direct Wire / ACH (Net-30) Available"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-300 font-semibold">BreachGuard</span>
            <span>&bull; External Cyber Risk Platform</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <a href="#features" className="hover:text-zinc-300 transition-colors">Pillars</a>
            <a href="#compliance" className="hover:text-zinc-300 transition-colors">Architecture</a>
            <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-zinc-300 transition-colors">Console</Link>
          </div>

          <div>
            &copy; {new Date().getFullYear()} BreachGuard Intelligence. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Enterprise Procurement & Invoicing Modal */}
      <InvoiceRequestModal 
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        defaultPlan={invoicePlan}
      />
    </div>
  );
}
