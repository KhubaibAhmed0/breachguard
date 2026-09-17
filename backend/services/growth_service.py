import re
import io
import csv
import json
import httpx
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple

from core.config import settings
from services.email_security import analyze_email_security
from services.external_attack_surface import analyze_attack_surface, discover_subdomains
from services.hibp_service import check_domain_breaches
from services.email_service import send_email

logger = logging.getLogger("breachguard.growth")

# Rate throttling state: track timestamps of recent outbound emails to protect sender IP/domain reputation
_outbound_history: List[float] = []
MAX_EMAILS_PER_MINUTE = 10
MIN_INTERVAL_SECONDS = 3.0

class RateThrottleException(Exception):
    pass

async def enforce_rate_throttle():
    """
    Guarantees outbound email dispatch respects cold outreach rate limits:
    - Maximum 10 emails per minute
    - Minimum 3-second spacing between sequential dispatches
    """
    import time
    global _outbound_history
    now = time.time()
    
    # Filter out entries older than 60 seconds
    _outbound_history = [t for t in _outbound_history if now - t < 60.0]
    
    if len(_outbound_history) >= MAX_EMAILS_PER_MINUTE:
        wait_time = 60.0 - (now - _outbound_history[0])
        raise RateThrottleException(
            f"Rate limit exceeded: Maximum {MAX_EMAILS_PER_MINUTE} outreach emails per minute to protect sender reputation. Please retry in {int(wait_time)} seconds."
        )

    if _outbound_history:
        elapsed = now - _outbound_history[-1]
        if elapsed < MIN_INTERVAL_SECONDS:
            await asyncio.sleep(MIN_INTERVAL_SECONDS - elapsed)

    _outbound_history.append(time.time())


async def run_passive_reconnaissance(domain: str) -> Dict[str, Any]:
    """
    Runs passive, non-intrusive reconnaissance against a target prospect domain:
    1. Email security (SPF, DMARC policy, DKIM, MX)
    2. Attack surface (Subdomains via crt.sh, passive open ports via Shodan InternetDB)
    3. Breaches (Domain breach correlation)
    """
    clean_domain = domain.lower().strip()
    clean_domain = re.sub(r"^https?://", "", clean_domain)
    clean_domain = re.sub(r"/.*$", "", clean_domain)
    clean_domain = re.sub(r"^www\.", "", clean_domain).split(":")[0]

    email_task = asyncio.create_task(analyze_email_security(clean_domain))
    attack_surface_task = asyncio.create_task(analyze_attack_surface(clean_domain))
    breaches_task = asyncio.create_task(check_domain_breaches(clean_domain))

    email_sec_res, attack_surface_res, breaches_res = await asyncio.gather(
        email_task, attack_surface_task, breaches_task, return_exceptions=True
    )

    email_sec = email_sec_res if isinstance(email_sec_res, dict) else {"score": 50, "findings": []}
    attack_surface = attack_surface_res if isinstance(attack_surface_res, dict) else {"assets": [], "findings": []}
    breaches = breaches_res if isinstance(breaches_res, list) else []

    # 1. DMARC Evaluation
    dmarc_obj = email_sec.get("dmarc", {})
    dmarc_policy = dmarc_obj.get("policy")
    dmarc_record = dmarc_obj.get("record")
    
    if not dmarc_record or dmarc_policy is None:
        dmarc_status = "missing"
    elif dmarc_policy == "none":
        dmarc_status = "p=none"
    elif dmarc_policy in ("quarantine", "reject"):
        dmarc_status = f"p={dmarc_policy}"
    else:
        dmarc_status = "not_enforced"

    # 2. Exposed Administrative Ports
    exposed_ports = []
    assets = attack_surface.get("assets", [])
    for asset in assets:
        ports = asset.get("open_ports", [])
        services = asset.get("services", {})
        for p in ports:
            p_int = int(p) if isinstance(p, (int, str)) and str(p).isdigit() else 0
            if p_int in [22, 23, 21, 3389, 3306, 5432, 27017, 6379, 5900, 8080, 8443]:
                svc_name = services.get(str(p_int)) or f"Port {p_int}"
                desc = f"Port {p_int} ({svc_name})"
                if desc not in exposed_ports:
                    exposed_ports.append(desc)

    subdomains_count = len(attack_surface.get("subdomains", []))
    breach_count = len(breaches)
    breach_sources = [b.get("source_name") for b in breaches if b.get("source_name")]

    # 3. Overall composite risk score (0-100)
    email_score = email_sec.get("score", 50)
    as_score = max(35, 100 - (subdomains_count * 3) - (len(exposed_ports) * 12))
    threat_score = max(25, 100 - (breach_count * 8))
    cred_score = 80 if breach_count == 0 else max(30, 85 - (breach_count * 6))

    posture = (as_score * 0.30) + (email_score * 0.25) + (threat_score * 0.20) + (cred_score * 0.25)
    risk_score = int(round(100.0 - posture))
    risk_score = max(12, min(92, risk_score))

    if risk_score >= 65:
        risk_level = "HIGH RISK"
    elif risk_score >= 35:
        risk_level = "MEDIUM RISK"
    else:
        risk_level = "LOW RISK"

    # Top findings summary
    top_findings = []
    if dmarc_status in ("missing", "p=none"):
        top_findings.append(
            f"Email Spoofing Exposure: Domain lacks DMARC enforcement ({'No record found' if dmarc_status == 'missing' else 'Policy set to p=none'}). Threat actors can send unauthorized emails pretending to be @{clean_domain}."
        )
    if exposed_ports:
        top_findings.append(
            f"Perimeter Exposure: Detected {len(exposed_ports)} open administrative services ({', '.join(exposed_ports[:3])}) visible to public internet scanners."
        )
    if breach_count > 0:
        top_findings.append(
            f"Credential Intelligence: Identified {breach_count} historical breach records associated with @{clean_domain} identities."
        )
    if subdomains_count > 4:
        top_findings.append(
            f"Attack Surface Breadth: Discovered {subdomains_count} public hostnames and subdomains via Certificate Transparency logs."
        )

    if not top_findings:
        top_findings.append(f"Basic security controls active. Perimeter score evaluated at {risk_score}/100.")

    return {
        "domain": clean_domain,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "dmarc_status": dmarc_status,
        "dmarc_record": dmarc_record,
        "exposed_ports": exposed_ports,
        "subdomains_count": subdomains_count,
        "breach_count": breach_count,
        "breach_sources": breach_sources[:6],
        "top_findings": top_findings
    }


def generate_cold_email_copy(lead_data: Dict[str, Any], angle: str = "dmarc_spoofing", attach_pdf: bool = False) -> Tuple[str, str]:
    """
    Generates high-converting, spam-safe personalized cold outreach copy.
    Optimized for Primary Inbox placement:
    - Conversational, human subject lines (no '[Security Notice]' or spam triggers)
    - Hand-raise CTA when attach_pdf=False (offers the 12-page PDF on reply to establish domain trust)
    - Direct attachment reference when attach_pdf=True
    Returns (subject, text_body).
    """
    company = lead_data.get("company_name") or "your team"
    clean_company = re.sub(r'[^a-zA-Z0-9_\-]', '_', company)
    contact_name = lead_data.get("contact_name")
    greeting = f"Hi {contact_name}," if contact_name and contact_name.strip() else f"Hello {company} team,"
    domain = lead_data.get("domain", "your company")
    dmarc_status = lead_data.get("dmarc_status", "missing")
    exposed_ports = lead_data.get("exposed_ports", [])
    if isinstance(exposed_ports, str):
        try:
            exposed_ports = json.loads(exposed_ports)
        except Exception:
            exposed_ports = []
    breach_count = lead_data.get("breach_count", 0)
    subdomains_count = lead_data.get("subdomains_count", 4)
    risk_score = lead_data.get("risk_score", 62)

    if angle == "dmarc_spoofing":
        subject = f"Quick question regarding {domain}'s email authentication"
        
        if dmarc_status == "missing":
            vuln_detail = f"I was reviewing external security configurations for organizations in your sector and noticed {domain} does not currently have an active DMARC policy in DNS."
            impact_detail = "Without DMARC enforcement, third parties can send fraudulent emails spoofing your domain name, which also harms legitimate transactional deliverability under Google and Yahoo's latest sender guidelines."
        elif dmarc_status == "p=none":
            vuln_detail = f"I was taking a look at external domain configurations across companies in your sector and noticed {domain} currently has DMARC configured with 'p=none' (monitoring only)."
            impact_detail = "Because policy enforcement is disabled, inbound mail providers (like Google Workspace and Microsoft 365) will still accept unauthorized spoofed emails sent under your domain."
        else:
            vuln_detail = f"I was reviewing external perimeter security across organizations in your sector and took a quick look at {domain}'s DNS and mail transport security."
            impact_detail = "While basic DMARC is present, key transport encryption and subdomain policies (MTA-STS, TLS-RPT) remain unconfigured."

        if not attach_pdf:
            body = f"""{greeting}

{vuln_detail}

{impact_detail}

We recently compiled a 12-page Executive Cyber Risk Assessment for {company} mapping out your email authentication gaps, discoverable subdomains, and external attack surface.

Would you like me to send over the PDF report? Let me know and I'll be happy to email it over.

Best regards,
Khubaib Ahmed
Founder, BreachGuard"""
        else:
            body = f"""{greeting}

{vuln_detail}

{impact_detail}

I have attached our complete 12-page Executive Cyber Risk Assessment for {company} directly to this email ({clean_company}_Executive_Cyber_Risk_Assessment.pdf).

The report includes:
• DMARC, SPF, and transport encryption (MTA-STS) gap analysis
• Discovered public hostnames and network port telemetry
• Unified External Cyber Risk Score ({risk_score}/100)
• Actionable 3-phase technical remediation roadmap

Would you be open to a brief 5-minute conversation this week to review the findings and ensure your domain authentication is fully protected?

Best regards,
Khubaib Ahmed
Founder, BreachGuard"""

    elif angle == "open_ports":
        subject = f"Question regarding {domain}'s perimeter services"
        ports_str = ", ".join(exposed_ports[:3]) if exposed_ports else "unmonitored administrative services"
        
        if not attach_pdf:
            body = f"""{greeting}

I'm reaching out because our external attack surface reconnaissance flagged potential perimeter exposure on {domain}.

Passive internet telemetry indexed the following externally reachable services:
• Exposed Services: {ports_str}
• Resolvable Hostnames: {subdomains_count} discovered in Certificate Transparency records

Exposing backend or administrative interfaces directly to the public internet makes endpoints prime targets for automated credential stuffing and port scanners.

We put together a 12-page Executive Cyber Risk Assessment for {company} detailing exact IP addresses, exposed port telemetry, and firewall isolation guidance.

Would you like me to send over the PDF report? Let me know and I'll email it over.

Best regards,
Khubaib Ahmed
Founder, BreachGuard"""
        else:
            body = f"""{greeting}

I'm reaching out because our external attack surface reconnaissance flagged potential perimeter exposure on {domain}.

Passive internet telemetry indexed the following externally reachable services:
• Exposed Services: {ports_str}
• Resolvable Hostnames: {subdomains_count} discovered in Certificate Transparency records

Exposing backend or administrative interfaces directly to the public internet makes endpoints prime targets for automated credential stuffing and port scanners.

I have attached our complete 12-page Executive Cyber Risk Assessment for {company} ({clean_company}_Executive_Cyber_Risk_Assessment.pdf) detailing exact IP addresses, port evidence, and firewall isolation guidance.

Would you be open to a quick 5-minute call this week to review our perimeter findings with your technical team?

Best regards,
Khubaib Ahmed
Founder, BreachGuard"""

    else:  # executive_summary
        subject = f"{company} — external perimeter overview ({domain})"
        
        if not attach_pdf:
            body = f"""{greeting}

We just completed a zero-touch external cyber risk review for {company} ({domain}).

Here is a brief snapshot of what external threat actors can observe about your perimeter today:
• Overall Perimeter Risk Score: {risk_score}/100
• Email Authentication: {dmarc_status.upper() if dmarc_status else 'Needs Review'}
• Compromised Identity Signals: {breach_count} breach records indexed
• External Hostnames: {subdomains_count} observable hostnames

We compiled a comprehensive 12-page Executive Cyber Risk Assessment for {company} containing the complete technical evidence, scoring methodology, and prioritized remediation roadmap.

Would you like me to send over the PDF report? Happy to email it across if you find it helpful.

Best regards,
Khubaib Ahmed
Founder, BreachGuard"""
        else:
            body = f"""{greeting}

We just completed a zero-touch external cyber risk review for {company} ({domain}).

Here is a brief snapshot of what external threat actors can observe about your perimeter today:
• Overall Perimeter Risk Score: {risk_score}/100
• Email Authentication: {dmarc_status.upper() if dmarc_status else 'Needs Review'}
• Compromised Identity Signals: {breach_count} breach records indexed
• External Hostnames: {subdomains_count} observable hostnames

I have attached our complete 12-page Executive Cyber Risk Assessment for {company} directly to this email ({clean_company}_Executive_Cyber_Risk_Assessment.pdf). It contains the complete technical evidence, scoring methodology, and prioritized remediation roadmap.

Let me know if you would like to discuss our recommendations or explore automated continuous perimeter defense for {company}.

Best regards,
Khubaib Ahmed
Founder, BreachGuard"""

    return subject, body.strip()



def render_outreach_html(lead_data: Dict[str, Any], subject: str, text_body: str) -> str:
    """
    Renders clean, professional, high-converting direct email:
    - Clean white/transparent background without dark black box wrappers
    - Clean text header without shield emoji
    - No external promotional scorecard buttons or .vercel.app links
    - Focuses recipient attention directly on the attached 12-page executive PDF
    """
    risk_score = lead_data.get("risk_score", 60)

    # Format plain text body paragraphs into clean HTML paragraphs
    paragraphs = text_body.strip().split("\n\n")
    body_html = ""
    for p in paragraphs:
        formatted = p.replace("\n", "<br/>")
        body_html += f'<p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.65; color: #1f2937;">{formatted}</p>'

    score_color = "#dc2626" if risk_score >= 65 else "#ea580c" if risk_score >= 35 else "#16a34a"

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 24px 16px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff;">
    <!-- Minimal Clean Header (No Shield Emoji, No Black Box) -->
    <div style="padding-bottom: 16px; margin-bottom: 22px; border-bottom: 1px solid #e5e7eb;">
      <table width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="left" style="vertical-align: middle;">
            <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.5px; color: #111827;">BREACHGUARD</span>
            <span style="display: block; font-size: 11.5px; color: #6b7280; margin-top: 2px;">External Cyber Risk &amp; Perimeter Defense</span>
          </td>
          <td align="right" style="vertical-align: middle;">
            <span style="display: inline-block; padding: 3px 8px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, monospace; color: {score_color}; font-weight: 600;">
              Risk: {risk_score}/100
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Content -->
    <div style="padding: 2px 0 16px 0;">
      {body_html}
    </div>

    <!-- Confidential Footer -->
    <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; line-height: 1.5;">
      This assessment was generated from non-intrusive, publicly discoverable internet telemetry.<br/>
      BreachGuard Threat Intelligence • Confidential Security Communication
    </div>
  </div>
</body>
</html>"""


# ==============================================================================
# PRE-LOADED SOCIAL MEDIA AUTOPILOT QUEUE (TWITTER/X & REDDIT)
# ==============================================================================

DEFAULT_SOCIAL_POSTS = [
    {
        "platform": "twitter",
        "category": "email_security",
        "cadence_day": 1,
        "title": "The DMARC 'p=none' Illusion",
        "hook": "73% of mid-market companies think they have DMARC protection. In reality, they are completely vulnerable to CEO impersonation.",
        "content": """73% of mid-market companies think they have DMARC protection.

In reality, they are completely vulnerable to CEO impersonation.

Here is why (and how to check your domain in 10 seconds): 🧵

1/ Setting "p=none" only turns on reporting. It tells inbox providers (Google, M365) to DO NOTHING when an attacker spoofs your domain.

2/ Attackers know this. They scan MX & DMARC records with automated scripts. When they find "p=none", your domain is greenlit for vendor fraud & executive phishing.

3/ In 2026, Google & Yahoo have also begun penalizing outbound deliverability for non-enforced domains. Your sales emails are silently hitting spam.

4/ How to fix it:
• Audit your sending sources (SendGrid, HubSpot, Zendesk)
• Publish strict DKIM keys
• Graduate your policy: p=none -> p=quarantine -> p=reject

We built a free tool that runs this full passive email audit for your domain:
👉 https://breachguard-khubbiahmed-1955s-projects.vercel.app/?ref=x-dmarc-thread

Drop your domain and see what your DMARC score actually looks like.""",
        "call_to_action": "Audit your domain's DMARC status free: https://breachguard-khubbiahmed-1955s-projects.vercel.app",
        "target_subreddit": None
    },
    {
        "platform": "reddit",
        "category": "attack_surface",
        "cadence_day": 4,
        "title": "We passively analyzed 500 corporate domains. Here are the 3 most common perimeter exposures we found.",
        "hook": "Over the past 2 months, we ran passive perimeter audits on 500 tech companies. The results were startling.",
        "content": """Over the past 2 months, our team ran passive perimeter reconnaissance on 500 growing B2B and SaaS organizations.

We didn't do any intrusive port-knocking or intrusive scans—just purely passive telemetry (Certificate Transparency logs, DNS resolution, and Shodan InternetDB).

Here are the top 3 exposures we discovered across more than 60% of them:

1. Forgotten Staging & Dev Subdomains (41% of companies)
Almost every company had active `staging.company.com`, `dev.company.com`, or `test-api.company.com` records that had been abandoned months ago. These instances had outdated packages, no WAF, and sometimes test accounts with simple passwords.

2. Exposed Administrative Ports (18% of companies)
We observed active listening services on port 22 (SSH), port 3389 (RDP), and even port 5432 (Postgres) reachable from the open internet without any IP allowlisting or VPN requirement.

3. DMARC Still Stuck at `p=none` (68% of companies)
Teams publish a DMARC record to pass compliance checkboxes, set the policy to `p=none`, and forget about it. Attackers can still spoof `@yourcompany.com` without inboxes blocking the emails.

How to audit your perimeter:
You don't need a $20k enterprise scanner to find these. You can inspect CT logs via crt.sh and test your email posture manually.

Alternatively, we built an open community scanner at https://breachguard-khubbiahmed-1955s-projects.vercel.app that bundles subdomain discovery, DMARC evaluation, and Shodan telemetry into a single 10-second report.

Curious: How often does your team audit external-facing subdomains?""",
        "call_to_action": "Run a free perimeter check on BreachGuard: https://breachguard-khubbiahmed-1955s-projects.vercel.app",
        "target_subreddit": "r/sysadmin"
    },
    {
        "platform": "twitter",
        "category": "threat_intel",
        "cadence_day": 7,
        "title": "Why Password Resets Don't Stop Infostealers",
        "hook": "Forcing employees to change passwords every 90 days is security theater when modern malware steals active session cookies.",
        "content": """Forcing employees to change passwords every 90 days is security theater.

Why? Modern infostealers (Redline, Lumma, Vidar) don't care about passwords.

They steal active session cookies (tokens) that bypass MFA entirely.

Here is the anatomy of a 2026 credential breach: 🧵

1/ Employee downloads a trojanized PDF or software crack on their home PC.
2/ Stealer malware dumps the local browser SQLite database containing decrypted session tokens.
3/ The logs are packaged into a `.zip` and uploaded to Telegram command channels within seconds.
4/ Attackers import the session cookie into their own browser. Boom—they are logged into your corporate Slack, Google Workspace, or AWS console without entering a password or triggering an MFA prompt.

The fix?
• Enforce device posture checks (Zero Trust / Conditional Access)
• Invalidate session tokens on IP/device mismatch
• Monitor dark web intelligence feeds continuously for employee emails

Check if any of your corporate credentials have been indexed:
👉 https://breachguard-khubbiahmed-1955s-projects.vercel.app/?ref=x-infostealers""",
        "call_to_action": "Check your domain's exposure index: https://breachguard-khubbiahmed-1955s-projects.vercel.app",
        "target_subreddit": None
    },
    {
        "platform": "reddit",
        "category": "msp_growth",
        "cadence_day": 10,
        "title": "How we use automated passive perimeter assessments to close $3k/mo MSP retainers without cold sales pitches",
        "hook": "A practical breakdown of how our MSP partners turn technical domain audits into high-conversion executive proposals.",
        "content": """If you run an MSP or MSSP, you know the hardest part of outbound sales is demonstrating immediate value before they sign an engagement letter.

Running an intrusive vulnerability scan without authorization is a legal non-starter. But sending generic 'Let us manage your IT' emails gets a 0.5% response rate.

Here is the exact passive reconnaissance workflow our partner MSPs use to close $2,500 - $5,000/mo retainers:

Step 1: Passive Reconnaissance
Run a zero-touch audit on the prospect's public domain:
- Check DMARC enforcement (most are p=none or missing)
- Inspect Certificate Transparency logs for exposed dev/test subdomains
- Cross-reference known corporate breach dumps

Step 2: The Executive Briefing (Not a Technical Dump)
Don't send 50 pages of CVE codes. Send a clean, 1-page executive summary:
- "Your domain can be spoofed today by anyone"
- "3 of your team's credentials were found in recent stealer logs"
- "Port 3389 is exposed on your backup server"

Step 3: Offer the Fix as Part of Ongoing Monitoring
The pitch isn't "Buy our software." It's "We already identified these 3 issues on your external perimeter. We can remediate these by Friday and set up 24/7 continuous monitoring for your leadership team."

We automated this entire pipeline inside BreachGuard (with full white-labeling and PDF report generation).

You can test the assessment engine free on your own domain: https://breachguard-khubbiahmed-1955s-projects.vercel.app

What does your current outbound lead-qualification workflow look like for new clients?""",
        "call_to_action": "Check out the passive assessment engine at https://breachguard-khubbiahmed-1955s-projects.vercel.app",
        "target_subreddit": "r/msp"
    },
    {
        "platform": "twitter",
        "category": "attack_surface",
        "cadence_day": 13,
        "title": "How Attackers Find Your Dev Servers in 4 Minutes",
        "hook": "Think your secret staging server is invisible because nobody has the URL? Think again.",
        "content": """Think your secret staging server is invisible because nobody has the URL?

Think again.

Threat actors know about your new subdomain before your team even deploys the code.

Here is how: Certificate Transparency (CT) logs. 🧵

1/ Whenever you generate an SSL/TLS certificate (via Let's Encrypt, Cloudflare, AWS), the Certificate Authority is legally required to publish it to a public, append-only CT log.

2/ Threat actors run automated scrapers monitoring crt.sh and Google CT streams 24/7.

3/ The second `admin-v2.yourcompany.com` or `dev-auth.yourcompany.com` gets a certificate, it is broadcast to the world.

4/ Within minutes, automated scanners are port-knocking and directory-busting that exact host.

How to protect yourself:
• Use wildcard certificates (`*.yourcompany.com`) so individual subdomains are never disclosed in public CT logs.
• Place all non-production environments behind an IP allowlist or Cloudflare Zero Trust tunnel.

Run a free scan to see every subdomain currently visible for your domain:
👉 https://breachguard-khubbiahmed-1955s-projects.vercel.app/?ref=x-ct-logs""",
        "call_to_action": "View your public subdomains: https://breachguard-khubbiahmed-1955s-projects.vercel.app",
        "target_subreddit": None
    },
    {
        "platform": "reddit",
        "category": "email_security",
        "cadence_day": 16,
        "title": "SPF vs DKIM vs DMARC: A practical cheat sheet for configuring bulletproof outbound email in 2026",
        "hook": "A clear, no-nonsense breakdown of how the 3 pillars of email authentication work together.",
        "content": """There is still a massive amount of confusion between SPF, DKIM, and DMARC, even among seasoned sysadmins.

Here is a straightforward reference guide:

1. SPF (Sender Policy Framework) - "Who is allowed to send?"
• What it is: A TXT record listing IP addresses and mail servers allowed to send mail on behalf of your domain.
• The flaw: SPF only validates the Return-Path (Mail From) header, NOT the user-visible "From:" header that users see in Outlook or Gmail. An attacker can pass SPF using their own domain while spoofing your company in the From: line!
• Limit: Keep DNS lookups under 10 (RFC limit).

2. DKIM (DomainKeys Identified Mail) - "Was the email tampered with?"
• What it is: A cryptographic signature attached to the email header and verified against a public key published in your DNS.
• The flaw: DKIM confirms the message wasn't altered in transit, but by itself, it doesn't instruct receivers on what to do if the signature is missing.

3. DMARC (Domain-based Message Authentication) - "The Enforcer"
• What it is: The policy that ties SPF and DKIM together. It mandates DMARC Alignment (the visible From: domain must match SPF or DKIM).
• Crucial: If your policy is `p=none`, inboxes only report failures; they don't block them. You need `p=quarantine` or `p=reject` to stop spoofing cold.

We built a free real-time DNS validator that tests your SPF lookup count, DKIM selectors, and DMARC alignment automatically:
https://breachguard-khubbiahmed-1955s-projects.vercel.app

Feel free to bookmark this cheat sheet!""",
        "call_to_action": "Test your DNS email records: https://breachguard-khubbiahmed-1955s-projects.vercel.app",
        "target_subreddit": "r/cybersecurity"
    }
]


# ==============================================================================
# GOOGLE SHEETS LIVE RECONNAISSANCE SYNC ENGINE
# ==============================================================================

def extract_google_sheet_export_url(url_or_id: str) -> str:
    """
    Extracts or normalizes a Google Sheets URL into its direct CSV export stream endpoint.
    Handles:
    - https://docs.google.com/spreadsheets/d/{ID}/edit...
    - https://docs.google.com/spreadsheets/d/{ID}/export?format=csv
    - https://docs.google.com/spreadsheets/d/e/{ID}/pubhtml / pub?output=csv
    - Raw sheet ID
    """
    cleaned = url_or_id.strip()
    if "/d/e/" in cleaned:
        if "pub" in cleaned and "output=csv" not in cleaned:
            return re.sub(r"/pub.*$", "/pub?output=csv", cleaned)
        elif not cleaned.endswith("output=csv"):
            separator = "&" if "?" in cleaned else "?"
            return f"{cleaned}{separator}output=csv"
        return cleaned

    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", cleaned)
    if match:
        sheet_id = match.group(1)
        # Also check for gid (specific sheet tab)
        gid_match = re.search(r"[#&?]gid=([0-9]+)", cleaned)
        gid_param = f"&gid={gid_match.group(1)}" if gid_match else ""
        return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv{gid_param}"

    # If raw ID
    if len(cleaned) > 20 and "/" not in cleaned and " " not in cleaned:
        return f"https://docs.google.com/spreadsheets/d/{cleaned}/export?format=csv"

    return cleaned


async def fetch_google_sheet_rows(sheet_url: str) -> List[Dict[str, str]]:
    """
    Fetches rows directly from a Google Sheet share link or published CSV.
    Uses smart column header recognition to map:
    - company_name
    - domain
    - contact_email
    - contact_name
    """
    export_url = extract_google_sheet_export_url(sheet_url)
    logger.info(f"Fetching Google Sheet CSV stream from: {export_url}")

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BreachGuard-Outreach-Engine/2.0"
        }
        try:
            res = await client.get(export_url, headers=headers)
        except Exception as net_err:
            raise ValueError(f"Could not connect to Google Sheets URL: {str(net_err)}")

        if res.status_code != 200:
            raise ValueError(
                f"Google Sheets returned HTTP {res.status_code}. Please ensure the sheet's General Access is set to 'Anyone with the link can view'."
            )
        
        content_type = res.headers.get("content-type", "").lower()
        if "html" in content_type and ("<html" in res.text.lower() or "accounts.google.com" in res.text.lower()):
            raise ValueError(
                "Received Google login page instead of CSV data. Please verify the Google Sheet sharing setting is set to 'Anyone with the link can view'."
            )
        
        csv_text = res.text

    # Parse CSV content
    f = io.StringIO(csv_text.strip())
    reader = csv.reader(f)
    try:
        header_row = next(reader)
    except StopIteration:
        return []

    # Map column positions dynamically
    col_map = {"company_name": -1, "domain": -1, "contact_email": -1, "contact_name": -1}

    for idx, col in enumerate(header_row):
        c_clean = col.lower().strip()
        if col_map["company_name"] == -1 and any(k in c_clean for k in ["company", "org", "business", "client", "firm", "account"]):
            col_map["company_name"] = idx
        elif col_map["domain"] == -1 and any(k in c_clean for k in ["domain", "website", "url", "web", "host"]):
            col_map["domain"] = idx
        elif col_map["contact_email"] == -1 and any(k in c_clean for k in ["email", "mail"]):
            col_map["contact_email"] = idx
        elif col_map["contact_name"] == -1 and any(k in c_clean for k in ["contact name", "contact", "founder", "lead", "person", "ceo", "first name", "name"]):
            col_map["contact_name"] = idx

    # If domain or email wasn't found by explicit name, fallback to positional if at least 3 columns
    if col_map["domain"] == -1 and len(header_row) >= 2:
        col_map["domain"] = 1
    if col_map["company_name"] == -1 and len(header_row) >= 1:
        col_map["company_name"] = 0
    if col_map["contact_email"] == -1 and len(header_row) >= 3:
        col_map["contact_email"] = 2
    if col_map["contact_name"] == -1 and len(header_row) >= 4:
        col_map["contact_name"] = 3

    parsed_rows = []
    for row in reader:
        if not row or not any(field.strip() for field in row):
            continue

        raw_company = row[col_map["company_name"]].strip() if col_map["company_name"] >= 0 and len(row) > col_map["company_name"] else ""
        raw_domain = row[col_map["domain"]].strip() if col_map["domain"] >= 0 and len(row) > col_map["domain"] else ""
        raw_email = row[col_map["contact_email"]].strip() if col_map["contact_email"] >= 0 and len(row) > col_map["contact_email"] else ""
        raw_name = row[col_map["contact_name"]].strip() if col_map["contact_name"] >= 0 and len(row) > col_map["contact_name"] else ""

        # Normalize domain
        clean_domain = raw_domain.lower()
        clean_domain = re.sub(r"^https?://", "", clean_domain).split("/")[0].split(":")[0].strip()
        if clean_domain.startswith("www."):
            clean_domain = clean_domain[4:]

        # Validate domain and email
        if not clean_domain or "." not in clean_domain or len(clean_domain) < 3:
            continue
        if not raw_email or "@" not in raw_email or "." not in raw_email:
            continue

        if not raw_company:
            raw_company = clean_domain.split(".")[0].capitalize()

        parsed_rows.append({
            "company_name": raw_company,
            "domain": clean_domain,
            "contact_email": raw_email.lower(),
            "contact_name": raw_name or None
        })

    return parsed_rows
