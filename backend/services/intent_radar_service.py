"""
Automated Social Buyer Intent Radar Service:
1. Ingests and monitors high-intent cybersecurity discussions on Reddit, Twitter/X, and tech forums.
2. Identifies acute buyer pain points (DMARC spoofing, open ports, infostealer credential leaks, MSP client assessments).
3. Extracts company names, corporate domains, and contact handles.
4. Calculates buying intent score (1-100%) and urgency level.
5. Generates value-first, non-salesy social reply hooks.
6. Integrates with BreachGuard's passive perimeter audit and Google Sheets export/webhook.
"""

import re
import json
import logging
import urllib.parse
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import httpx

from models.growth import ProspectSignal, OutreachLead

logger = logging.getLogger("breachguard.intent_radar")

# High-conversion buying signal keyword taxonomy
INTENT_KEYWORDS = {
    "dmarc_spoofing": {
        "critical": ["dmarc failing", "p=none", "ceo impersonat", "impersonat", "spoof", "bounced by google", "bounced by yahoo", "spoofed our domain", "spf 10-lookup", "dkim failed", "lacks dmarc", "no dmarc", "wire transfer"],
        "high": ["dmarc report", "dmarc policy", "email deliverability", "spf record", "spoofing protection", "mailserver rejected", "dmarc quarantine", "dmarc enforcement"],
        "medium": ["dmarc", "spf", "dkim", "mx record", "outbound email"]
    },
    "credential_leak": {
        "critical": ["infostealer", "stealer logs", "credentials dumped", "session token", "passwords leaked", "dark web", "breached account", "stolen credential"],
        "high": ["compromised credentials", "employee login leaked", "credential stuffing", "telegram log dump", "breach notification"],
        "medium": ["password reset", "2fa bypass", "phishing victim", "compromised email"]
    },
    "attack_surface": {
        "critical": ["open rdp", "open ssh", "port 22 open", "port 3389", "redis exposed", "database open to internet", "shodan found us", "exposed port"],
        "high": ["external attack surface", "open ports", "exposed admin", "subdomain takeover", "unprotected server", "port scan alert"],
        "medium": ["firewall rule", "aws security group", "public ip", "external ip scan"]
    },
    "msp_compliance": {
        "critical": ["client security assessment", "soc 2 external audit", "hipaa perimeter scan", "looking for cybersecurity tool", "need tool to scan clients", "soc 2 vendor"],
        "high": ["msp security audit", "cyber insurance questionnaire", "vendor risk assessment", "client vulnerability scan", "external penetration test"],
        "medium": ["compliance check", "security baseline", "cyber insurance", "msp tool"]
    }
}

# Domains to ignore during company domain extraction
DISALLOWED_DOMAINS = {
    "reddit.com", "redd.it", "twitter.com", "x.com", "t.co", "google.com", "youtube.com",
    "facebook.com", "instagram.com", "linkedin.com", "github.com", "gitlab.com",
    "imgur.com", "pastebin.com", "microsoft.com", "apple.com", "amazon.com", "aws.com",
    "shodan.io", "virustotal.com", "wikipedia.org", "medium.com", "substack.com"
}

# Pre-seeded catalog of realistic, high-converting buyer discussions
PRESEEDED_SIGNALS = [
    {
        "platform": "reddit",
        "source_url": "https://www.reddit.com/r/sysadmin/comments/1f8a92k/gmail_and_yahoo_rejecting_half_our_executive/",
        "author_handle": "u/CloudAdminDave",
        "author_name": "Dave Miller (Sysadmin)",
        "post_title": "Gmail and Yahoo rejecting half our executive outbound emails — DMARC is set to p=none",
        "post_snippet": "We have 150 employees at CloudLogix (cloudlogix.io). Since Google and Yahoo tightened bulk sender rules, our emails to clients keep getting rejected or sent to spam. Our DMARC is still at p=none and SPF lookup limit is hitting 11. What automated tool can we use to get to p=reject without breaking legitimate marketing tools?",
        "intent_category": "dmarc_spoofing",
        "intent_score": 96,
        "urgency_level": "critical",
        "extracted_company": "CloudLogix",
        "extracted_domain": "cloudlogix.io",
        "extracted_email": "dave@cloudlogix.io",
        "suggested_reply": "Hey Dave, you're hitting two classic blockers: 1) Google/Yahoo treat p=none as an unenforced policy, so any slight SPF/DKIM misalignment flags as spam. 2) The 10 DNS lookup limit breaks authentication when you stack marketing tools (HubSpot/Sendgrid). You can test your exact domain alignment passively using BreachGuard's free scanner (breachguard.io/?scan=cloudlogix.io) to see which subdomains are failing SPF alignment before switching to quarantine.",
        "suggested_email_angle": "dmarc_spoofing"
    },
    {
        "platform": "reddit",
        "source_url": "https://www.reddit.com/r/msp/comments/1f9b31x/how_are_msps_running_fast_passive_external_risk/",
        "author_handle": "u/MSP_Brett",
        "author_name": "Brett Reynolds",
        "post_title": "How are MSPs running fast passive external risk assessments for prospective clients?",
        "post_snippet": "I run Apex Managed IT (apexmanagedit.com). We pitch $3k/month co-managed security retainers. When meeting with a prospect, we need a clean 1-click external scan report showing their missing DMARC, open admin ports, and dark web leaks so we can show value on the first call without asking them to install agents.",
        "intent_category": "msp_compliance",
        "intent_score": 94,
        "urgency_level": "high",
        "extracted_company": "Apex Managed IT",
        "extracted_domain": "apexmanagedit.com",
        "extracted_email": "brett@apexmanagedit.com",
        "suggested_reply": "Brett, non-intrusive passive reconnaissance is the #1 conversion lever for MSP pitches because you don't need credentials or permission to map their public attack surface. You can run their domain through BreachGuard (breachguard.io) — it queries certificate transparency logs, Shodan InternetDB for open ports (22, 3389, 5432), and DMARC enforcement, then generates a branded executive scorecard you can hand to their CEO.",
        "suggested_email_angle": "executive_summary"
    },
    {
        "platform": "reddit",
        "source_url": "https://www.reddit.com/r/cybersecurity/comments/1f7c84m/employee_infostealer_dumped_active_session_tokens/",
        "author_handle": "u/SecEng_Marcus",
        "author_name": "Marcus Vance",
        "post_title": "Employee infostealer dumped active session tokens and credentials on Telegram forums",
        "post_snippet": "We caught a RedLine stealer infection at Nova Payments (novapayments.net) originating from a contractor's personal device. It exfiltrated browser cookies and corporate credentials. We need continuous dark web and infostealer monitoring so we're notified immediately when an employee email appears in breach dumps.",
        "intent_category": "credential_leak",
        "intent_score": 98,
        "urgency_level": "critical",
        "extracted_company": "Nova Payments",
        "extracted_domain": "novapayments.net",
        "extracted_email": "marcus@novapayments.net",
        "suggested_reply": "Marcus, RedLine and Lumma infostealers bypass traditional MFA by dumping active session cookies directly from SQLite browser profiles. Password resets alone won't kill the session — you need to invalidate all active refresh tokens and monitor dark web breach feeds. You can cross-check novapayments.net on BreachGuard's threat feed to see if historical dumps exist.",
        "suggested_email_angle": "executive_summary"
    },
    {
        "platform": "twitter",
        "source_url": "https://x.com/fintech_founder/status/176982103948210",
        "author_handle": "@alex_fintech",
        "author_name": "Alex Thorne",
        "post_title": "Discovered AWS Security Group typo exposed Redis & SSH to the internet",
        "post_snippet": "Scary morning at Quantum Banking (quantumbanking.co). A terraform misconfiguration left our staging Redis (6379) and SSH (22) exposed to 0.0.0.0/0 for 48 hours. What continuous attack surface management tool automatically scans and alerts on open ports before Shodan indexes them?",
        "intent_category": "attack_surface",
        "intent_score": 93,
        "urgency_level": "critical",
        "extracted_company": "Quantum Banking",
        "extracted_domain": "quantumbanking.co",
        "extracted_email": "alex@quantumbanking.co",
        "suggested_reply": "Alex, Shodan and automated botnets scan the entire IPv4 space within 45 minutes of a port being opened. BreachGuard (breachguard.io/?scan=quantumbanking.co) runs passive external attack surface audits mapping all certificate transparency subdomains and listening administrative interfaces with automated risk scoring.",
        "suggested_email_angle": "open_ports"
    },
    {
        "platform": "reddit",
        "source_url": "https://www.reddit.com/r/startups/comments/1f6d90p/enterprise_client_demanding_soc2_vendor_security/",
        "author_handle": "u/SaaS_Founder_Eli",
        "author_name": "Eli Rosen",
        "post_title": "Enterprise client demanding SOC 2 vendor security assessment before signing $85k contract",
        "post_snippet": "We are closing an $85k enterprise contract for Vortex Analytics (vortexanalytics.com). Their CISO sent an exhaustive 40-question vendor risk assessment asking about our public attack surface, DMARC enforcement, and dark web monitoring. We need a fast perimeter scorecard to attach.",
        "intent_category": "msp_compliance",
        "intent_score": 91,
        "urgency_level": "high",
        "extracted_company": "Vortex Analytics",
        "extracted_domain": "vortexanalytics.com",
        "extracted_email": "eli@vortexanalytics.com",
        "suggested_reply": "Eli, enterprise CISOs typically look at external signals to verify if what you wrote on the questionnaire matches reality: 1) Does your domain have DMARC p=reject? 2) Are there exposed ports on your apex domain or staging subdomains? You can generate an instant executive perimeter scorecard at breachguard.io to verify your external posture.",
        "suggested_email_angle": "dmarc_spoofing"
    },
    {
        "platform": "reddit",
        "source_url": "https://www.reddit.com/r/sysadmin/comments/1f5e22k/ceo_impersonation_email_almost_cost_us_40k/",
        "author_handle": "u/ITDirector_Mark",
        "author_name": "Mark Stevens",
        "post_title": "CEO impersonation email almost cost us $40k wire transfer — spoofing vulnerability",
        "post_snippet": "Finance received an email appearing directly from our CEO at Vector Logistics (vectorlogistics.net) requesting an urgent wire. Because our domain had no DMARC record, the attacker spoofed our exact ceo@vectorlogistics.net email address without getting flagged by Outlook. We need to enforce anti-spoofing immediately.",
        "intent_category": "dmarc_spoofing",
        "intent_score": 97,
        "urgency_level": "critical",
        "extracted_company": "Vector Logistics",
        "extracted_domain": "vectorlogistics.net",
        "extracted_email": "mark@vectorlogistics.net",
        "suggested_reply": "Mark, this is classic Business Email Compromise (BEC). Without a DMARC policy (p=reject or p=quarantine), any external mail server can put your CEO's address in the From: header and Outlook will render their name with zero warning. You can audit vectorlogistics.net's exact DMARC and SPF alignment at breachguard.io/?scan=vectorlogistics.net.",
        "suggested_email_angle": "dmarc_spoofing"
    },
    {
        "platform": "reddit",
        "source_url": "https://www.reddit.com/r/msp/comments/1f4g19m/looking_for_automated_dark_web_monitoring_for/",
        "author_handle": "u/MSP_GrowthGuy",
        "author_name": "Greg Henderson",
        "post_title": "Looking for automated dark web monitoring tool for 25 client domains",
        "post_snippet": "We manage IT for 25 small businesses at Delta IT Solutions (deltaitsolutions.com). We want to add dark web credential monitoring to our $150/seat managed package so clients get notified when an employee's password shows up in a data breach. Looking for alternatives to overpriced enterprise platforms.",
        "intent_category": "credential_leak",
        "intent_score": 92,
        "urgency_level": "high",
        "extracted_company": "Delta IT Solutions",
        "extracted_domain": "deltaitsolutions.com",
        "extracted_email": "greg@deltaitsolutions.com",
        "suggested_reply": "Greg, most dark web monitoring platforms charge hefty minimums per seat. BreachGuard (breachguard.io) offers white-label domain and employee exposure monitoring where you can monitor client domains passively, generate co-branded PDF risk audits, and notify clients automatically.",
        "suggested_email_angle": "executive_summary"
    },
    {
        "platform": "twitter",
        "source_url": "https://x.com/healthtech_cto/status/17698210399812",
        "author_handle": "@rachel_cto",
        "author_name": "Rachel Adams",
        "post_title": "HIPAA compliance audit coming up for our telehealth platform",
        "post_snippet": "Preparing for HIPAA compliance at CareSync Telehealth (caresynchealth.io). Auditors specifically scrutinize public perimeter exposure, open database ports, and email security. Need a simple tool to verify our public attack surface is locked down.",
        "intent_category": "attack_surface",
        "intent_score": 90,
        "urgency_level": "high",
        "extracted_company": "CareSync Telehealth",
        "extracted_domain": "caresynchealth.io",
        "extracted_email": "rachel@caresynchealth.io",
        "suggested_reply": "Rachel, HIPAA auditors verify technical safeguards by checking whether administrative ports (RDP, SSH, DBs) are reachable and whether email transmission is protected against interception and spoofing. You can run caresynchealth.io through BreachGuard (breachguard.io) to get an immediate perimeter audit report.",
        "suggested_email_angle": "open_ports"
    }
]


def extract_domain_and_company(title: str, text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extracts corporate domain, company name, and email from post title and body text.
    Filters out common public services (reddit, twitter, imgur, google).
    """
    combined = f"{title} {text}"
    
    # 1. Email extraction
    email_match = re.search(r'\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b', combined)
    extracted_email = email_match.group(0).lower() if email_match else None
    
    # 2. Domain extraction
    domain_matches = re.findall(r'\b(?:https?://)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,})\b', combined)
    extracted_domain = None
    for dom in domain_matches:
        clean = dom.lower().strip()
        if clean not in DISALLOWED_DOMAINS and not clean.endswith(('.png', '.jpg', '.jpeg', '.gif', '.pdf')):
            extracted_domain = clean
            break
            
    if not extracted_domain and extracted_email:
        extracted_domain = extracted_email.split("@")[-1]

    # 3. Company extraction
    extracted_company = None
    comp_match = re.search(r'(?:at|for|run|company|named)\s+([A-Z][a-zA-Z0-9\s]{2,20})(?:\s+\(|\s+\[|\s+is|\s*\.|\s*,)', combined)
    if comp_match:
        candidate = comp_match.group(1).strip()
        if len(candidate) > 2 and candidate.lower() not in {"google", "reddit", "twitter", "microsoft"}:
            extracted_company = candidate
            
    if not extracted_company and extracted_domain:
        base = extracted_domain.split(".")[0]
        extracted_company = base.capitalize()

    return extracted_company, extracted_domain, extracted_email


def calculate_buyer_intent(title: str, text: str) -> Tuple[str, int, str]:
    """
    Calculates buying intent score (1-100%), intent category, and urgency level.
    """
    combined = f"{title.lower()} {text.lower()}"
    
    best_category = "dmarc_spoofing"
    highest_score = 65
    
    for category, levels in INTENT_KEYWORDS.items():
        cat_score = 50
        for kw in levels["critical"]:
            if kw in combined:
                cat_score += 35
                break
        for kw in levels["high"]:
            if kw in combined:
                cat_score += 20
                break
        for kw in levels["medium"]:
            if kw in combined:
                cat_score += 10
                break
                
        buying_signals = ["looking for", "recommend", "need tool", "alternative to", "budget", "pricing", "closing", "cost us", "audit coming", "need help", "asap", "urgent", "targeted", "breached"]
        for bs in buying_signals:
            if bs in combined:
                cat_score += 12
                break
                
        if cat_score > highest_score:
            highest_score = min(cat_score, 98)
            best_category = category

    if highest_score >= 85:
        urgency = "critical"
    elif highest_score >= 75:
        urgency = "high"
    else:
        urgency = "medium"

    return best_category, highest_score, urgency


def generate_suggested_reply(category: str, company: Optional[str], domain: Optional[str], title: str) -> str:
    """
    Generates a conversational, value-first response hook tailored for the founder
    to post as a comment on Reddit or X.
    """
    target = domain or (f"{company.lower()}.com" if company else "your domain")
    scanner_link = f"breachguard.io/?scan={target}" if domain else "breachguard.io"
    
    if category == "dmarc_spoofing":
        return (
            f"Dealing with DMARC deliverability flags usually boils down to two things: "
            f"1) Unaligned third-party senders (HubSpot/SendGrid) breaking SPF, and 2) Sticking at `p=none` which major providers treat as unenforced. "
            f"You can test your exact DMARC and SPF alignment passively at {scanner_link} before switching your policy to quarantine."
        )
    elif category == "credential_leak":
        return (
            f"Infostealer malware dumps active SQLite browser cookies that bypass traditional 2FA. "
            f"Make sure to invalidate all session refresh tokens across IdPs, not just reset passwords. "
            f"You can cross-check {target} against known breach feeds using {scanner_link} to see if historical employee credentials have circulated."
        )
    elif category == "attack_surface":
        return (
            f"Automated scanners and botnets probe IPv4 ranges constantly—open administrative ports (22, 3389, DB ports) get indexed in minutes. "
            f"BreachGuard ({scanner_link}) maps public perimeter exposure and certificate transparency subdomains without intrusive scans."
        )
    else: # msp_compliance
        return (
            f"Running fast, non-intrusive external audits is the highest-leverage way to show clients immediate gaps without needing admin credentials. "
            f"You can run {target} through {scanner_link} to get an executive scorecard of their missing email protections and open attack surface."
        )


def export_signals_to_csv(signals: List[ProspectSignal]) -> str:
    """
    Formats prospect signals into a clean, Google Sheets-ready CSV string.
    Columns match the Google Sheets intake engine for seamless 1-click import.
    """
    lines = [
        "Company Name,Domain,Contact Email,Contact Name,Intent Score,Urgency,Pain Category,Post Title,Platform,Source URL,Discovered Date"
    ]
    for s in signals:
        comp = f'"{s.extracted_company or "Unknown"}"'
        dom = s.extracted_domain or ""
        email = s.extracted_email or ""
        name = f'"{s.author_name or s.author_handle}"'
        score = str(s.intent_score)
        urgency = s.urgency_level
        category = s.intent_category
        title = f'"{s.post_title.replace(chr(34), chr(39))}"'
        platform = s.platform
        url = s.source_url
        date_str = s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else ""
        lines.append(f"{comp},{dom},{email},{name},{score},{urgency},{category},{title},{platform},{url},{date_str}")
        
    return "\n".join(lines)


async def push_signal_to_google_sheet_webhook(webhook_url: str, signal: ProspectSignal) -> bool:
    """
    Dispatches a single prospect signal to a Google Apps Script / Make / Zapier webhook
    to automatically append it as a new row in the user's live Google Sheet.
    """
    if not webhook_url or not webhook_url.startswith("http"):
        return False
        
    payload = {
        "company_name": signal.extracted_company or "Unknown",
        "domain": signal.extracted_domain or "",
        "contact_email": signal.extracted_email or "",
        "contact_name": signal.author_name or signal.author_handle,
        "intent_score": signal.intent_score,
        "urgency": signal.urgency_level,
        "intent_category": signal.intent_category,
        "post_title": signal.post_title,
        "source_url": signal.source_url,
        "suggested_reply": signal.suggested_reply,
        "created_at": signal.created_at.isoformat() if signal.created_at else datetime.utcnow().isoformat()
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            res = await client.post(webhook_url, json=payload)
            return res.status_code in (200, 201, 302)
    except Exception as e:
        logger.error(f"Failed to push signal to Google Sheet webhook {webhook_url}: {e}")
        return False
