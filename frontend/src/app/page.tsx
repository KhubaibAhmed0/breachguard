"use client";

import { ScanInput, ScanResultData } from '@/components/ScanInput';
import { PricingCard } from '@/components/PricingCard';
import { InvoiceRequestModal } from '@/components/InvoiceRequestModal';
import { RiskScoreGauge } from '@/components/RiskScoreGauge';
import { 
  Shield, FileText, CheckCircle2, ArrowRight, Database, 
  Lock, Check, AlertCircle, ShieldCheck, X, Network, MailCheck, Radar, KeyRound, Globe, Server, Menu
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function LandingPage() {
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoicePlan, setInvoicePlan] = useState<'business' | 'enterprise'>('enterprise');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const overallScore = scanResult?.overall_risk_score ?? 15;
  const riskLevel = scanResult?.risk_level ?? 'LOW RISK';
  const riskBadgeBg = 
    overallScore >= 65 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
    overallScore >= 40 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
    'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';

  return (
    <div className="min-h-screen bg-[#09090b] text-text-primary flex flex-col selection:bg-border-strong selection:text-text-primary">
      
      {/* Navigation */}
      <nav className="border-b border-border-default bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-bg-surface border border-border-default flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-text-secondary" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-text-primary uppercase font-mono">
              BreachGuard
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-text-muted">
            <a href="#features" className="hover:text-text-secondary transition-colors">Pillars</a>
            <a href="#compliance" className="hover:text-text-secondary transition-colors">Architecture</a>
            <a href="#pricing" className="hover:text-text-secondary transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-xs font-medium text-text-muted hover:text-text-primary px-2.5 sm:px-3 py-1.5 transition-colors">
              Log in
            </Link>
            <Link href="/register" className="text-xs font-medium px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-text rounded-md transition-colors">
              Get started
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="md:hidden p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {isMobileNavOpen && (
          <div className="md:hidden px-4 py-3 bg-bg-surface border-b border-border-default flex flex-col gap-2 text-xs text-text-secondary">
            <a 
              href="#features" 
              onClick={() => setIsMobileNavOpen(false)}
              className="py-1.5 px-2 rounded hover:bg-border-strong text-text-secondary transition-colors"
            >
              Pillars
            </a>
            <a 
              href="#compliance" 
              onClick={() => setIsMobileNavOpen(false)}
              className="py-1.5 px-2 rounded hover:bg-border-strong text-text-secondary transition-colors"
            >
              Architecture
            </a>
            <a 
              href="#pricing" 
              onClick={() => setIsMobileNavOpen(false)}
              className="py-1.5 px-2 rounded hover:bg-border-strong text-text-secondary transition-colors"
            >
              Pricing
            </a>
          </div>
        )}
      </nav>

      <main className="flex-1">
                {/* Hero Section */}
        <section className="relative pt-24 sm:pt-32 pb-20 sm:pb-28 px-4 text-center max-w-5xl mx-auto overflow-hidden">
          {/* Subtle radial gradient background behind text instead of an image */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-bg-surface/30 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
            See What Attackers See.<br className="hidden sm:block" />
            <span className="text-text-muted">Defend What Others Miss.</span>
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            BreachGuard provides continuous, deterministic external attack surface management and threat intelligence. Zero agents required. Zero arbitrary penalties.
          </p>

          <div className="max-w-2xl mx-auto">
            <ScanInput onScanComplete={(data) => setScanResult(data)} />
          </div>
        </section>

        {/* Prestige Strip */}
        <section className="border-y border-border-default bg-bg-surface/50 py-8 px-4">
          <div className="max-w-6xl mx-auto flex flex-col items-center">
            <p className="text-2xs font-mono font-medium uppercase tracking-wider text-text-faint mb-6 text-center">
              Continuously monitoring millions of assets across the global internet
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              <span className="text-xl font-bold tracking-tighter text-text-muted">AcmeCorp</span>
              <span className="text-xl font-bold tracking-tighter text-text-muted">GlobalTech</span>
              <span className="text-xl font-bold tracking-tighter text-text-muted">CyberNet</span>
              <span className="text-xl font-bold tracking-tighter text-text-muted">DataFlow</span>
              <span className="text-xl font-bold tracking-tighter text-text-muted">CloudSync</span>
            </div>
          </div>
        </section>

        {/* Scan Results Panel — External Risk Snapshot */}
        {scanResult && (
          <section className="py-8 px-4 max-w-4xl mx-auto">
            <div className="py-8 border-t border-border-default space-y-8 mt-12">
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-2xs text-text-faint uppercase tracking-wider font-mono mb-0.5">
                      External Cyber Risk Snapshot
                    </div>
                    <h2 className="text-xl font-semibold text-text-primary tracking-tight font-mono">
                      {scanResult.domain}
                    </h2>
                  </div>
                </div>

                <div className="p-4">
                  <RiskScoreGauge score={overallScore} size="md" showSpectrumBar={true} showExplanation={true} />
                </div>
              </div>

              {/* 4 Pillars Snapshot Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 space-y-1">
                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-text-faint" />
                    Attack Surface
                  </div>
                  <div className="text-lg font-semibold text-text-primary font-mono">{scanResult.discovered_assets_count ?? 1}</div>
                  <div className="text-2xs text-text-faint">Discovered subdomains</div>
                </div>

                <div className="p-3 space-y-1">
                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <MailCheck className="w-3.5 h-3.5 text-text-faint" />
                    Email Security
                  </div>
                  <div className="text-lg font-semibold text-text-primary font-mono">{scanResult.email_security_score ?? 60}/100</div>
                  <div className="text-2xs text-text-faint">SPF &amp; DMARC audit</div>
                </div>

                <div className="p-3 space-y-1">
                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <Radar className="w-3.5 h-3.5 text-text-faint" />
                    Threat Intel
                  </div>
                  <div className="text-lg font-semibold text-text-primary font-mono">{scanResult.breach_count}</div>
                  <div className="text-2xs text-text-faint">Public breach archives</div>
                </div>

                <div className="p-3 space-y-1">
                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-text-faint" />
                    Identities
                  </div>
                  <div className="text-lg font-semibold text-text-primary font-mono">{scanResult.total_exposures}</div>
                  <div className="text-2xs text-text-faint">Exposures monitored</div>
                </div>
              </div>

              {/* Sample Observed Findings */}
              {scanResult.sample_findings && scanResult.sample_findings.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-medium text-text-muted">Sample Observed Findings:</div>
                  <div className="space-y-1.5">
                    {scanResult.sample_findings.map((finding, idx) => (
                      <div key={idx} className="py-2.5 border-b border-border-default/50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-text-secondary">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{finding.title}</span>
                        </div>
                        <span className="text-text-faint font-mono text-2xs">{finding.evidence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Confirmation Banner when no exposures found */}
              {scanResult.total_exposures === 0 && (!scanResult.sample_findings || scanResult.sample_findings.length === 0) && (
                <div className="py-4 border-y border-border-default/50 flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-text-secondary">Scan completed — no exposure detected</div>
                    <div className="text-xs text-text-muted mt-0.5">No exposed corporate accounts, open administrative services, or security weaknesses were detected for this target.</div>
                  </div>
                </div>
              )}

              {/* Conversion Box */}
              <div className="pt-6 mt-4 border-t border-border-default space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-text-secondary">
                      {scanResult.conversion_title || 'Get the complete security assessment & remediation report'}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      The paid product provides continuous perimeter auditing, change detection, and 10–15 page audit-ready PDF reports.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link 
                      href="/login" 
                      className="px-3 py-1.5 rounded-md bg-bg-surface hover:bg-border-strong text-text-secondary border border-border-default text-xs font-medium transition-colors"
                    >
                      Log in
                    </Link>
                    <Link 
                      href="/register" 
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium rounded-md transition-colors flex items-center gap-1"
                    >
                      Start 7-day trial <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-text-muted pt-2 border-t border-border-default">
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-muted" /> Continuous attack surface &amp; port monitoring</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-muted" /> Actionable DMARC/SPF technical guidance</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-muted" /> 10–15 page executive &amp; compliance PDF reports</div>
                  <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-muted" /> Automated alerts for newly exposed services</div>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Security Architecture Alignment */}
        <section id="compliance" className="py-12 border-y border-border-default bg-[#0c0c0e]">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <p className="text-2xs font-mono font-medium uppercase tracking-wider text-text-faint mb-4">
              Security architecture aligned with industry standards
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs text-text-muted font-mono">
              <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-faint" /> SOC 2 Aligned Controls</span>
              <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-faint" /> ISO 27001 Control Mapping</span>
              <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-faint" /> Cyber Insurance Due-Diligence Ready</span>
              <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-text-faint" /> NIST CSF Aligned</span>
            </div>
          </div>
        </section>

        {/* Platform Capabilities (4 Pillars) */}
                <section id="features" className="py-24 px-4 max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight mb-3">
              One coherent cybersecurity platform, not unrelated scanners.
            </h2>
            <p className="text-sm sm:text-base text-text-muted max-w-xl">
              Evaluate your external perimeter from all four critical angles to eliminate blind spots.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 sm:gap-16 mb-16">
            {/* Pillar 1 */}
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border-default flex items-center justify-center text-text-primary">
                <Network className="w-5 h-5" />
              </div>
              <div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">Zero-Touch Asset Discovery</h3>
                  <p className="text-text-muted text-sm leading-relaxed">
                    Continuously map your external perimeter, identify shadow IT, and monitor exposed ports and certificates without deploying a single agent.
                  </p>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border-default flex items-center justify-center text-text-primary">
                <MailCheck className="w-5 h-5" />
              </div>
              <div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">Hardened Communication Channels</h3>
                  <p className="text-text-muted text-sm leading-relaxed">
                    Automate SPF, DKIM, and DMARC analysis to prevent domain spoofing and intercept supply chain phishing attacks.
                  </p>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border-default flex items-center justify-center text-text-primary">
                <Radar className="w-5 h-5" />
              </div>
              <div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">Real-Time Adversary Correlation</h3>
                  <p className="text-text-muted text-sm leading-relaxed">
                    Map your public assets against active weaponized CVEs and global threat telemetry. Focus on real risks, not noisy alerts.
                  </p>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border-default flex items-center justify-center text-text-primary">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">Deep &amp; Dark Web Surveillance</h3>
                  <p className="text-text-muted text-sm leading-relaxed">
                    Detect compromised employee and customer credentials harvested by infostealer malware before they are monetized on dark web marketplaces.
                  </p>
              </div>
            </div>
          </div>

          {/* Feature 5: Reports */}
          <div className="pt-12 border-t border-border-default flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-text-primary" />
                <h3 className="text-base font-semibold text-text-primary">10–15 Page Executive &amp; Compliance Assessments</h3>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">
                Generate structured, publication-grade PDF reports complete with prioritized 0-24h remediation roadmaps, methodology disclosures, and technical verification steps.
              </p>
            </div>
            <Link href="/register" className="px-5 py-2.5 bg-text-primary hover:bg-white text-bg-base text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 mt-2 md:mt-0 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Generate Sample Report &rarr;
            </Link>
          </div>
        </section>

        
        {/* Deterministic Scoring Engine Section */}
        <section className="py-24 px-4 bg-bg-base border-t border-border-default">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-default bg-bg-surface text-text-muted text-xs font-mono">
                <Radar className="w-3.5 h-3.5 text-accent" />
                <span>Deterministic v2.4 Engine</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight leading-tight">
                Objective Scoring.<br/>No Black Boxes.
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed max-w-lg">
                Unlike legacy rating platforms that penalize you based on arbitrary formulas, BreachGuard's Deterministic model provides transparent, evidence-based scoring. You always know exactly why your score changed and how to fix it.
              </p>
              <ul className="space-y-3 pt-4">
                <li className="flex items-center gap-3 text-sm text-text-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Transparent scoring methodology
                </li>
                <li className="flex items-center gap-3 text-sm text-text-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Evidence-based vulnerability correlation
                </li>
                <li className="flex items-center gap-3 text-sm text-text-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero arbitrary rating penalties
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full p-8 flex items-center justify-center relative overflow-visible">
              {/* Subtle background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
              
              <div className="relative z-10 scale-125">
                <RiskScoreGauge score={92} size="lg" showSpectrumBar={true} showExplanation={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 max-w-5xl mx-auto border-t border-border-default">
          <div className="text-center mb-14">
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight mb-2">
              Straightforward subscription pricing
            </h2>
            <p className="text-xs text-text-muted">Predictable monthly billing with no annual lock-in.</p>
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
              price="$799" 
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
      <footer className="border-t border-border-default bg-[#09090b] py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-text-faint">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-text-muted" />
            <span className="text-text-secondary font-semibold font-mono">BreachGuard</span>
            <span>&bull; External Cyber Risk Platform</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <a href="#features" className="hover:text-text-secondary transition-colors">Pillars</a>
            <a href="#compliance" className="hover:text-text-secondary transition-colors">Architecture</a>
            <a href="#pricing" className="hover:text-text-secondary transition-colors">Pricing</a>
            <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-text-secondary transition-colors">Console</Link>
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
