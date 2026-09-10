"use client";

import { ScanInput, ScanResultData } from '@/components/ScanInput';
import { PricingCard } from '@/components/PricingCard';
import { 
  Shield, FileText, CheckCircle2, ArrowRight, Database, 
  Lock, Check, AlertCircle, ShieldCheck, X
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function LandingPage() {
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);

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
            <a href="#features" className="hover:text-zinc-200 transition-colors">Capabilities</a>
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
            Identity threat monitoring for organizations &bull; 7-day free trial
          </div>

          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white leading-tight mb-6">
            Credential exposure monitoring for modern teams.
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Continuously detect leaked corporate credentials, third-party database breaches, and infostealer malware logs across underground threat feeds.
          </p>

          <ScanInput onScanComplete={(data) => setScanResult(data)} />

          <p className="mt-4 text-xs text-zinc-500">
            Non-intrusive external reconnaissance. Zero configuration required &bull; 7-day free trial.
          </p>
        </section>

        {/* Scan Results Panel */}
        {scanResult && (
          <section className="py-10 px-4 max-w-4xl mx-auto">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6 mb-6">
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">
                    {scanResult.target_type === 'email' ? 'Identity lookup' : 'Domain perimeter'}
                  </div>
                  <h2 className="text-2xl font-semibold text-white tracking-tight">
                    {scanResult.domain}
                  </h2>
                </div>

                <div>
                  {scanResult.total_exposures > 0 ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      {scanResult.total_exposures} exposures identified
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      No public exposures detected
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                  <div className="text-xs text-zinc-500 mb-1">Total exposures</div>
                  <div className="text-2xl font-semibold text-zinc-100">{scanResult.total_exposures}</div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                  <div className="text-xs text-zinc-500 mb-1">Breach archives</div>
                  <div className="text-2xl font-semibold text-zinc-100">{scanResult.breach_count}</div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                  <div className="text-xs text-zinc-500 mb-1">High priority</div>
                  <div className="text-2xl font-semibold text-amber-400">
                    {scanResult.severity_breakdown.critical + scanResult.severity_breakdown.high}
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                  <div className="text-xs text-zinc-500 mb-1">Status</div>
                  <div className="text-2xl font-semibold text-zinc-100">
                    {scanResult.total_exposures > 0 ? 'Action required' : 'Clear'}
                  </div>
                </div>
              </div>

              {/* Detected Sources */}
              {scanResult.breach_names && scanResult.breach_names.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-medium text-zinc-400 mb-3">Identified breach sources:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {scanResult.breach_names.map((name, i) => (
                      <div key={i} className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-zinc-300 font-medium">
                          <Database className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{name}</span>
                        </div>
                        <span className="text-zinc-500 font-mono text-[11px]">Archived</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Scan Completed Confirmation */}
              {scanResult.total_exposures === 0 && (
                <div className="mb-6 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
                  <Check className="w-4 h-4 text-zinc-300 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Scan completed — no exposure detected</div>
                    <div className="text-xs text-zinc-400 mt-0.5">No exposed corporate accounts or credentials were found across indexed threat archives for this target.</div>
                  </div>
                </div>
              )}

              {/* Redacted Forensics Teaser */}
              {scanResult.total_exposures > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-medium text-zinc-300">Identity &amp; Credential Forensics</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Restricted Preview</span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span className="text-zinc-500">Identity:</span>
                        <span className="blur-[3px] select-none text-zinc-300">admin@{scanResult.domain}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-sans">Hidden</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-zinc-500 font-sans">
                        <span className="blur-[2px] select-none">Compromised Credentials &amp; Indicators</span>
                        <Lock className="w-3 h-3 text-zinc-500" />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 mt-2.5">
                    Individual compromised email addresses, credential artifacts, and session indicators are hidden to protect organizational privacy.
                  </p>
                </div>
              )}

              {/* Action Banner */}
              <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-medium text-white">Unlock full threat telemetry</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Sign up or log in to view the in-depth forensic analysis and remediation steps.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Link 
                    href="/login" 
                    className="flex-1 sm:flex-none text-center px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium transition-colors"
                  >
                    Log in
                  </Link>
                  <Link 
                    href="/register" 
                    className="flex-1 sm:flex-none text-center px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Start 7-day free trial <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Compliance & Governance Alignment */}
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

        {/* Features Section */}
        <section id="features" className="py-24 px-4 max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
              Automated identity security without operational overhead.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl">
              Focus on actionable risks instead of parsing noisy vulnerability alerts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center mb-5 text-zinc-200">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Infostealer &amp; botnet intelligence</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Detect corporate accounts and employee credentials compromised by infostealer malware families (such as RedLine, Vidar, and Lumma) before threat actors exploit exfiltrated access.
              </p>
            </div>

            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center mb-5 text-zinc-200">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">External perimeter discovery</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Continuous reconnaissance across your registered domains to identify exposed accounts, third-party vendor leaks, and neglected test domains.
              </p>
            </div>

            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center mb-5 text-zinc-200">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Auditable executive reports</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Generate structured technical PDF reports to assist security teams, auditors, and leadership during identity risk assessments.
              </p>
            </div>
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
              description="Essential perimeter reconnaissance and breach detection for small teams."
              features={[
                '1 monitored domain',
                '5 privileged identities',
                'Daily perimeter scans',
                'Public breaches & leaks (Full)',
                'Infostealer intelligence (Summary)',
                'Email notification alerts',
                'Standard executive reports',
                '90 days retention'
              ]}
              ctaText="Start with Essential"
              subtext="Cancel or upgrade anytime"
            />
            <PricingCard 
              title="Business" 
              price="$239" 
              badge="MOST POPULAR"
              description="Complete credential exposure monitoring for growing security teams."
              features={[
                '3 monitored domains',
                '25 privileged identities',
                'Continuous threat monitoring',
                'Full infostealer & botnet intelligence',
                'Email + Slack + Teams alerts',
                'Custom-branded PDF audit reports',
                '1 year telemetry retention',
                '4h priority security support'
              ]}
              isPopular
              ctaText="Start 7-Day Free Trial"
              subtext="No credit card required • Instant access"
            />
            <PricingCard 
              title="Enterprise / MSP" 
              price="$899" 
              description="Integrated security operations, REST API & multi-tenant MSP console."
              features={[
                '15 monitored domains',
                'Unlimited privileged identities',
                'Real-time webhook intelligence',
                'Full infostealer & botnet intelligence',
                'SIEM + PagerDuty + Webhooks',
                'White-label / MSP reports',
                'Multi-tenant MSP console',
                'Full REST API & 1h dedicated support'
              ]}
              ctaText="Deploy Enterprise"
              subtext="Includes MSP console & REST API"
            />
          </div>

          {/* Detailed Feature Comparison Table */}
          <div className="max-w-4xl mx-auto bg-zinc-900/40 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800/80">
              <h3 className="text-lg font-semibold text-white tracking-tight">Full Plan Feature Comparison</h3>
              <p className="text-xs text-zinc-400 mt-1">Compare specifications, security limits, and enterprise capabilities.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 font-medium text-zinc-400">
                    <th className="p-4 w-1/3 text-zinc-300">Feature</th>
                    <th className="p-4 text-center">Essential</th>
                    <th className="p-4 text-center bg-zinc-900/70 border-x border-zinc-800 text-white font-semibold">
                      Business
                    </th>
                    <th className="p-4 text-center">Enterprise / MSP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-normal">
                  <tr className="bg-zinc-950/20">
                    <td className="p-4 font-semibold text-white">Monthly</td>
                    <td className="p-4 text-center font-semibold text-white text-sm">$99</td>
                    <td className="p-4 text-center font-semibold text-white text-sm bg-zinc-900/40 border-x border-zinc-800">$239</td>
                    <td className="p-4 text-center font-semibold text-white text-sm">$899</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Domains</td>
                    <td className="p-4 text-center text-zinc-400 font-mono">1</td>
                    <td className="p-4 text-center text-zinc-200 font-mono font-medium bg-zinc-900/40 border-x border-zinc-800">3</td>
                    <td className="p-4 text-center text-zinc-200 font-mono font-medium">15</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Privileged identities</td>
                    <td className="p-4 text-center text-zinc-400 font-mono">5</td>
                    <td className="p-4 text-center text-zinc-200 font-mono font-medium bg-zinc-900/40 border-x border-zinc-800">25</td>
                    <td className="p-4 text-center text-emerald-400 font-mono font-medium">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Monitoring</td>
                    <td className="p-4 text-center text-zinc-400">Daily</td>
                    <td className="p-4 text-center text-zinc-200 font-medium bg-zinc-900/40 border-x border-zinc-800">Continuous</td>
                    <td className="p-4 text-center text-emerald-400 font-medium">Real-time webhooks</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Public breaches &amp; leaks</td>
                    <td className="p-4 text-center text-zinc-300">Full</td>
                    <td className="p-4 text-center text-zinc-200 bg-zinc-900/40 border-x border-zinc-800 font-medium">Full</td>
                    <td className="p-4 text-center text-zinc-200 font-medium">Full</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Infostealer intelligence</td>
                    <td className="p-4 text-center text-zinc-500">Summary</td>
                    <td className="p-4 text-center bg-zinc-900/40 border-x border-zinc-800 text-emerald-400 font-medium">Full intelligence</td>
                    <td className="p-4 text-center text-emerald-400 font-medium">Full intelligence</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Risk scoring</td>
                    <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-4 text-center bg-zinc-900/40 border-x border-zinc-800"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-4 text-center text-emerald-400 font-medium">Advanced</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Alerts</td>
                    <td className="p-4 text-center text-zinc-400">Email</td>
                    <td className="p-4 text-center text-zinc-200 bg-zinc-900/40 border-x border-zinc-800 font-medium">Email + Slack + Teams</td>
                    <td className="p-4 text-center text-emerald-400 font-medium">SIEM + PagerDuty + Webhooks</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Reports</td>
                    <td className="p-4 text-center text-zinc-400">Standard</td>
                    <td className="p-4 text-center text-zinc-200 bg-zinc-900/40 border-x border-zinc-800 font-medium">Branded</td>
                    <td className="p-4 text-center text-emerald-400 font-medium">White-label / MSP</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Retention</td>
                    <td className="p-4 text-center text-zinc-400">90 days</td>
                    <td className="p-4 text-center text-zinc-200 bg-zinc-900/40 border-x border-zinc-800 font-medium">1 year</td>
                    <td className="p-4 text-center text-emerald-400 font-medium">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">REST API</td>
                    <td className="p-4 text-center"><X className="w-4 h-4 text-zinc-600 mx-auto" /></td>
                    <td className="p-4 text-center bg-zinc-900/40 border-x border-zinc-800"><X className="w-4 h-4 text-zinc-600 mx-auto" /></td>
                    <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Support</td>
                    <td className="p-4 text-center text-zinc-500">Standard</td>
                    <td className="p-4 text-center bg-zinc-900/40 border-x border-zinc-800 text-zinc-300">4h priority</td>
                    <td className="p-4 text-center text-emerald-400 font-medium">1h dedicated</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Custom integrations</td>
                    <td className="p-4 text-center"><X className="w-4 h-4 text-zinc-600 mx-auto" /></td>
                    <td className="p-4 text-center bg-zinc-900/40 border-x border-zinc-800"><X className="w-4 h-4 text-zinc-600 mx-auto" /></td>
                    <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-zinc-300">Multi-tenant MSP console</td>
                    <td className="p-4 text-center"><X className="w-4 h-4 text-zinc-600 mx-auto" /></td>
                    <td className="p-4 text-center bg-zinc-900/40 border-x border-zinc-800"><X className="w-4 h-4 text-zinc-600 mx-auto" /></td>
                    <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2 text-zinc-400">
            <Shield className="w-4 h-4" />
            <span className="font-semibold text-zinc-200">BreachGuard</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}