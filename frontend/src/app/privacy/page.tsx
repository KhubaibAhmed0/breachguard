"use client";

import Link from 'next/link';
import { Shield, ArrowLeft, Lock, CheckCircle2, FileText, EyeOff, Database, Server } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 12, 2026";

  return (
    <div className="min-h-screen bg-[#09090b] text-text-secondary flex flex-col selection:bg-border-strong selection:text-text-primary">
      
      {/* Top Navigation */}
      <nav className="border-b border-border-default bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded bg-bg-surface border border-border-default flex items-center justify-center group-hover:border-border-strong transition-colors">
              <Shield className="w-3.5 h-3.5 text-text-secondary" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-text-primary uppercase font-mono">
              BreachGuard
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Link>
            <Link 
              href="/login" 
              className="text-xs font-medium px-3 py-1.5 bg-bg-surface hover:bg-border-strong text-text-secondary border border-border-default rounded-md transition-colors"
            >
              Console Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="border-b border-border-default bg-[#0e0e10] py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-border-default bg-bg-surface text-text-muted text-2xs font-mono">
            <Lock className="w-3 h-3 text-emerald-400" />
            DATA PROTECTION &amp; PRIVACY
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-text-muted">
            Last updated: {lastUpdated} &bull; Applicable across all BreachGuard web applications, monitoring APIs, and client portals.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1 space-y-8 text-xs sm:text-sm leading-relaxed text-text-secondary">
        
        {/* Zero Password Storage Guarantee Banner */}
        <div className="p-4 rounded-lg bg-[#141416] border border-emerald-500/25 text-text-secondary space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-emerald-400 text-xs">
            <EyeOff className="w-4 h-4 text-emerald-400" />
            Zero Raw Credential Storage Guarantee
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            BreachGuard adheres to a strict zero-credential storage policy. When cross-referencing compromised credential sources or infostealer dumps, BreachGuard <strong className="text-text-secondary">never stores plain-text employee passwords</strong> in any persistent database. Only cryptographic hash digests, leak source names, breach timestamps, and metadata are maintained for defensive alerting purposes.
          </p>
        </div>

        {/* Section 1: Overview */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            1. Overview
          </h2>
          <p>
            BreachGuard Intelligence (&quot;BreachGuard&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting the privacy, confidentiality, and security of our customers and their organizational assets. This Privacy Policy explains how we collect, process, store, and safeguard data when you access our cybersecurity platform, configure monitored domains, or utilize our perimeter risk scoring services.
          </p>
        </section>

        {/* Section 2: Data We Collect */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            2. Information We Collect
          </h2>
          <p>We collect only the minimal data necessary to deliver our attack surface and email security monitoring:</p>
          
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default space-y-1.5">
              <div className="font-semibold text-text-secondary text-xs flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-text-muted" />
                Account &amp; Workspace Data
              </div>
              <p className="text-text-muted text-xs">
                Organization name, work email address, cryptographically hashed passwords (Bcrypt/Argon2 with individual salt), tenant identifiers, and role-based permissions (Admin, Analyst, Member).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-bg-surface border border-border-default space-y-1.5">
              <div className="font-semibold text-text-secondary text-xs flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-text-muted" />
                Target Domain Telemetry
              </div>
              <p className="text-text-muted text-xs">
                Customer-submitted root domains, publicly resolved DNS records (A, AAAA, MX, TXT, NS), public Certificate Transparency log records, and public email authentication headers (SPF, DMARC, DKIM, MTA-STS).
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: How We Use Data */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            3. How We Use Information
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-text-muted">
            <li>Calculating external cyber risk posture scores (0–100) and email security anti-spoofing grades.</li>
            <li>Generating technical and executive PDF audit reports for cybersecurity insurance and compliance.</li>
            <li>Dispatching real-time notifications via email, Slack webhooks, and SIEM integrations when critical risks or new attack surface assets are detected.</li>
            <li>Enforcing organizational plan quotas, multi-tenant isolation, and rate limiting safeguards.</li>
            <li>BreachGuard <strong>never sells</strong>, rents, or monetizes customer data or monitored asset telemetry to third-party data brokers.</li>
          </ul>
        </section>

        {/* Section 4: Infrastructure & Subprocessors */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            4. Third-Party Subprocessors
          </h2>
          <p>
            We utilize reputable, SOC 2 / ISO 27001 compliant cloud infrastructure providers to operate the Service:
          </p>
          <div className="border border-border-default rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-surface/80 border-b border-border-default text-text-secondary font-semibold">
                  <th className="p-2.5">Subprocessor</th>
                  <th className="p-2.5">Purpose</th>
                  <th className="p-2.5">Data Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/60 text-text-muted">
                <tr>
                  <td className="p-2.5 font-medium text-text-secondary">Supabase (PostgreSQL)</td>
                  <td className="p-2.5">Encrypted multi-tenant relational database</td>
                  <td className="p-2.5">United States / EU</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-text-secondary">Vercel Inc.</td>
                  <td className="p-2.5">Next.js application &amp; API serverless hosting</td>
                  <td className="p-2.5">Global Edge Network</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-text-secondary">Resend Inc.</td>
                  <td className="p-2.5">Transactional email delivery (password resets, invites)</td>
                  <td className="p-2.5">United States</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-text-secondary">Stripe Inc.</td>
                  <td className="p-2.5">PCI-DSS compliant payment &amp; subscription billing</td>
                  <td className="p-2.5">United States</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Data Retention */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            5. Data Retention &amp; Automated Pruning
          </h2>
          <p>
            BreachGuard enforces automated telemetry retention policies aligned with subscription tiers:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-text-muted">
            <li><strong className="text-text-secondary">Free Trial / Essential:</strong> Historical scan results and exposure telemetry are automatically pruned after 90 days.</li>
            <li><strong className="text-text-secondary">Business Tier:</strong> Monitored telemetry is retained for 365 days (1 year) for historical trend tracking.</li>
            <li><strong className="text-text-secondary">Enterprise / MSP:</strong> Custom configurable retention or indefinite audit logging.</li>
            <li><strong className="text-text-secondary">Account Deletion:</strong> Upon organization termination, all associated domains, email identities, and telemetry logs are permanently purged from active databases within 30 days.</li>
          </ul>
        </section>

        {/* Section 6: Security Safeguards */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            6. Security Safeguards
          </h2>
          <p>
            We implement comprehensive technical and organizational measures to safeguard customer information, including:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-text-muted">
            <li>End-to-end TLS 1.3 encryption for all data in transit.</li>
            <li>AES-256 encryption at rest for database records and audit logs.</li>
            <li>HttpOnly, Secure, SameSite session cookies preventing cross-site scripting (XSS) token theft.</li>
            <li>Strict multi-tenant row-level access boundaries preventing horizontal privilege escalation (IDOR / BOLA).</li>
            <li>Automated rate-limiting and progressive authentication delay to thwart brute-force attempts.</li>
          </ul>
        </section>

        {/* Section 7: User Rights & Contact */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            7. Your Rights &amp; Contact Information
          </h2>
          <p className="text-text-muted">
            Under applicable data protection laws (including GDPR and CCPA), you have the right to access, rectify, export, or request deletion of your account and organizational telemetry. To exercise these rights or contact our data protection team:
          </p>
          <div className="p-3 rounded-lg bg-bg-surface border border-border-default text-xs font-mono text-text-secondary">
            BreachGuard Intelligence &bull; Data Privacy Office<br />
            Email: privacy@breachguard.io &bull; security@breachguard.io
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border-default bg-bg-base py-8 px-4 text-center text-xs text-text-faint">
        &copy; {new Date().getFullYear()} BreachGuard Intelligence. All rights reserved. &bull; <Link href="/terms" className="hover:text-text-secondary underline underline-offset-4">Terms of Service</Link>
      </footer>

    </div>
  );
}
