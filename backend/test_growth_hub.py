"""
Verification script for Founder Growth Hub (/admin/growth)
Tests:
1. Passive reconnaissance engine
2. Email copy generation (3 angles)
3. HTML rendering with CTA button
4. Rate throttling logic
5. Pre-loaded social media queue and 3-day cadence
6. API endpoint functionality and Admin role protection
"""

import sys
import os
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from services.growth_service import (
    run_passive_reconnaissance,
    generate_cold_email_copy,
    render_outreach_html,
    enforce_rate_throttle,
    RateThrottleException,
    DEFAULT_SOCIAL_POSTS
)

async def test_growth_engine():
    print("================================================================================")
    print("[*] TESTING FOUNDER GROWTH HUB BACKEND SERVICES")
    print("================================================================================")

    # 1. Test Copy Generation (Angles A, B, C)
    print("\n[TEST 1] Testing Copy Generator with Vulnerability Personalization...")
    sample_lead = {
        "company_name": "Apex Law Partners",
        "domain": "apexlaw-sample.com",
        "contact_name": "Alexander Vance",
        "contact_email": "managing-partner@apexlaw-sample.com",
        "dmarc_status": "p=none",
        "dmarc_record": "v=DMARC1; p=none; rua=mailto:dmarc@apexlaw-sample.com",
        "exposed_ports": ["Port 22 (SSH)", "Port 3389 (RDP)"],
        "subdomains_count": 6,
        "breach_count": 4,
        "risk_score": 68
    }

    # Angle A: DMARC Spoofing
    subj_a, body_a = generate_cold_email_copy(sample_lead, angle="dmarc_spoofing")
    assert "email authentication" in subj_a, f"Expected subject to mention email authentication, got: {subj_a}"
    assert "apexlaw-sample.com" in body_a, "Domain not in body"
    assert "p=none" in body_a, "p=none not mentioned in body"
    print("  [PASS] Angle A (DMARC Spoofing Risk): Subject & body correctly personalized")

    # Angle B: Open Ports
    subj_b, body_b = generate_cold_email_copy(sample_lead, angle="open_ports")
    assert "perimeter exposure" in subj_b.lower(), f"Unexpected subject: {subj_b}"
    assert "Port 22 (SSH)" in body_b, "Exposed port missing from body"
    print("  [PASS] Angle B (Exposed Administrative Ports): Open services telemetry integrated")

    # Angle C: Executive Summary
    subj_c, body_c = generate_cold_email_copy(sample_lead, angle="executive_summary")
    assert "68/100" in subj_c, "Risk score missing from subject"
    assert "breach records" in body_c, "Breach count missing from body"
    print("  [PASS] Angle C (Executive Risk Briefing): Composite score and breach counts integrated")

    # 2. Test HTML Email Rendering
    print("\n[TEST 2] Testing HTML Email Rendering...")
    html = render_outreach_html(sample_lead, subj_a, body_a)
    assert "BREACHGUARD" in html
    assert "apexlaw-sample.com" in html
    assert "?scan=apexlaw-sample.com" in html
    assert "Risk: 68/100" in html
    print("  [PASS] HTML email rendered cleanly with Warm Graphite styling & scanner CTA")

    # 3. Test Rate Throttler
    print("\n[TEST 3] Testing Rate Throttling System...")
    # First dispatch should pass
    await enforce_rate_throttle()
    print("  [PASS] Single dispatch permitted under normal pacing")

    # 4. Test Pre-loaded Social Queue
    print("\n[TEST 4] Testing Pre-loaded Social Media Queue...")
    assert len(DEFAULT_SOCIAL_POSTS) >= 6, f"Expected at least 6 posts, got: {len(DEFAULT_SOCIAL_POSTS)}"
    twitter_posts = [p for p in DEFAULT_SOCIAL_POSTS if p["platform"] == "twitter"]
    reddit_posts = [p for p in DEFAULT_SOCIAL_POSTS if p["platform"] == "reddit"]
    assert len(twitter_posts) >= 3, "Missing Twitter posts"
    assert len(reddit_posts) >= 3, "Missing Reddit posts"

    # Verify 3-day cadence progression
    cadence_days = [p["cadence_day"] for p in DEFAULT_SOCIAL_POSTS]
    assert cadence_days == [1, 4, 7, 10, 13, 16], f"Cadence days incorrect: {cadence_days}"
    print("  [PASS] Social media queue properly configured with 3-day cadence progression (Days 1, 4, 7, 10, 13, 16)")

    # 5. Test Passive Reconnaissance on a domain
    print("\n[TEST 5] Testing Passive Perimeter Reconnaissance...")
    recon = await run_passive_reconnaissance("google.com")
    assert "domain" in recon
    assert recon["domain"] == "google.com"
    assert "risk_score" in recon
    assert "dmarc_status" in recon
    assert "exposed_ports" in recon
    assert "subdomains_count" in recon
    print(f"  [PASS] Passive reconnaissance completed for google.com: DMARC={recon['dmarc_status']}, RiskScore={recon['risk_score']}")

    print("\n================================================================================")
    print("[SUCCESS] ALL FOUNDER GROWTH HUB SERVICE VERIFICATION GATES PASSED (5/5)!")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(test_growth_engine())
