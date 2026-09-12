"use client";

import Link from 'next/link';
import { Shield, ArrowLeft, Scale } from 'lucide-react';

export default function TermsOfServicePage() {
  const lastUpdated = "September 12, 2026";

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 flex flex-col selection:bg-zinc-800 selection:text-zinc-100">
      
      {/* Top Navigation */}
      <nav className="border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-700 transition-colors">
              <Shield className="w-3.5 h-3.5 text-zinc-200" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-zinc-100 uppercase font-mono">
              BreachGuard
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Link>
            <Link 
              href="/login" 
              className="text-xs font-medium px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-md transition-colors"
            >
              Console Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="border-b border-zinc-800 bg-[#0e0e10] py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 text-[10.5px] font-mono">
            <Scale className="w-3 h-3 text-zinc-400" />
            LEGAL COMPLIANCE
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-400">
            Last updated: {lastUpdated} &bull; Effective immediately for all users, organizations, and MSP partners.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1 space-y-8 text-xs sm:text-sm leading-relaxed text-zinc-300">
        
        {/* Important Notice Callout */}
        <div className="p-4 rounded-lg bg-[#121214] border border-zinc-800 text-zinc-300 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-zinc-200 text-xs">
            <Shield className="w-4 h-4 text-zinc-400" />
            External Risk &amp; Passive Reconnaissance Scope
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            BreachGuard operates exclusively through non-intrusive, non-destructive external telemetry: passive Certificate Transparency (CT) logs, public DNS lookups, public threat intelligence feeds, and non-exploitative network telemetry. We do not perform intrusive port penetration testing, exploit execution, or vulnerability exploitation against client systems.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            1. Acceptance of Terms
          </h2>
          <p>
            By creating an account, accessing the BreachGuard console, or utilizing any of our APIs, reporting capabilities, or perimeter monitoring services (collectively, the &quot;Service&quot;), you (&quot;Customer&quot;, &quot;User&quot;, or &quot;Partner&quot;) agree to be legally bound by these Terms of Service. If you are entering into these Terms on behalf of an organization or business entity, you represent and warrant that you possess the requisite authority to bind that entity.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            2. Scope of Services &amp; Target Authorization
          </h2>
          <p>
            BreachGuard provides continuous external cyber risk posture assessment, email anti-spoofing governance (SPF, DMARC, DKIM, MTA-STS, TLS-RPT), passive attack surface discovery, and threat intelligence correlation.
          </p>
          <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-2 text-xs">
            <div className="font-semibold text-zinc-200">Customer Authorization Guarantee:</div>
            <p className="text-zinc-400">
              You expressly warrant that any domain names, fully-qualified domain names (FQDNs), or digital assets submitted to the Service are owned by your organization or that you have received explicit, verifiable authorization from the rightful owner to monitor said assets (including under Managed Security Service Provider / MSP arrangements).
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            3. Prohibited Uses &amp; Conduct
          </h2>
          <p>
            You agree not to use BreachGuard for any unlawful, harassing, malicious, or abusive activities. Specifically, you agree NOT to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
            <li>Target, inspect, or monitor domains belonging to third parties without prior legitimate authorization.</li>
            <li>Use the intelligence, exposure findings, or discovered telemetry to orchestrate cyberattacks, extortion, unauthorized access, or vulnerability exploitation.</li>
            <li>Attempt to reverse-engineer, decompile, or disrupt the integrity or performance of the BreachGuard platform or underlying infrastructure.</li>
            <li>Bypass rate limits, security controls, tenant isolation barriers, or role-based access restrictions.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            4. Free Trials, Subscriptions &amp; Billing
          </h2>
          <p>
            BreachGuard offers subscription plans including Business and Enterprise/MSP tiers, alongside 7-day complimentary evaluation trials:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
            <li><strong className="text-zinc-200">7-Day Free Trial:</strong> All newly registered organizations receive full access to Business-tier monitoring for seven calendar days without requiring credit card pre-authorization.</li>
            <li><strong className="text-zinc-200">Subscription Fees:</strong> Paid subscriptions are billed in advance on a recurring monthly or annual basis via Stripe. All payments are processed in US Dollars (USD).</li>
            <li><strong className="text-zinc-200">Cancellation:</strong> You may cancel your subscription at any time via the billing portal. Access continues through the conclusion of the active prepaid billing cycle.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            5. Disclaimers &amp; Limitation of Liability
          </h2>
          <p>
            THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. WHILE BREACHGUARD EMPLOYS INDUSTRY-STANDARD HEURISTICS, THREAT FEEDS, AND VERIFICATION PROTOCOLS, CYBERSECURITY RISKS EVOLVE CONTINUOUSLY. BREACHGUARD DOES NOT GUARANTEE THAT THE PLATFORM WILL DETECT EVERY VULNERABILITY, ATTACK VECTOR, OR SYSTEM WEAKNESS, NOR DOES IT GUARANTEE IMMUNITY FROM SECURITY INCIDENTS OR DATA BREACHES.
          </p>
          <p className="text-zinc-400">
            IN NO EVENT SHALL BREACHGUARD, ITS AFFILIATES, OR LICENSORS BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS REPUTATION, EXCEEDING THE AGGREGATE FEES PAID BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            6. Intellectual Property &amp; Audit Reports
          </h2>
          <p>
            BreachGuard retains all rights, title, and interest in its proprietary software, scoring algorithms, and user interface. Customers retain full ownership of their organizational telemetry and are granted an irrevocable, perpetual license to use, download, and distribute generated PDF audit and technical reports for internal compliance, cyber insurance underwriting, and executive auditing.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            7. Contact Information
          </h2>
          <p className="text-zinc-400">
            For questions regarding these Terms of Service or to submit legal inquiries, please contact:
          </p>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
            BreachGuard Intelligence &bull; Legal &amp; Governance<br />
            Email: legal@breachguard.io &bull; security@breachguard.io
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 px-4 text-center text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} BreachGuard Intelligence. All rights reserved. &bull; <Link href="/privacy" className="hover:text-zinc-300 underline underline-offset-4">Privacy Policy</Link>
      </footer>

    </div>
  );
}
