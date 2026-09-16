"""
Automated Verification Suite for Buyer Intent Radar:
1. Tests intent scoring, category classification, and urgency mapping.
2. Tests corporate domain, email, and company extraction.
3. Tests value-first response hook generation.
4. Tests REST API endpoints for radar listing, URL ingestion, conversion to OutreachLead, and Google Sheets CSV export.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from main import app
from models.user import User
from routers.deps import get_current_user
from services.intent_radar_service import (
    calculate_buyer_intent,
    extract_domain_and_company,
    generate_suggested_reply,
    export_signals_to_csv,
    PRESEEDED_SIGNALS
)

client = TestClient(app)

def test_intent_radar():
    print("================================================================================")
    print("[*] TESTING AUTOMATED BUYER INTENT RADAR & GOOGLE SHEETS PIPELINE")
    print("================================================================================")

    # 1. Test Intent Scoring Logic
    print("\n[TEST 1] Testing Intent Scoring & Urgency Detection...")
    title = "Our DMARC is failing and Google is bouncing all our outbound emails"
    text = "We have 80 employees and clients keep complaining about deliverability. Need a tool to fix p=none."
    cat, score, urgency = calculate_buyer_intent(title, text)
    assert cat == "dmarc_spoofing", f"Expected dmarc_spoofing, got {cat}"
    assert score >= 85, f"Expected critical score >= 85, got {score}"
    assert urgency == "critical"
    print(f"  [PASS] Correctly classified {cat} with urgency score {score}% ({urgency})")

    # 2. Test Entity & Domain Extraction
    print("\n[TEST 2] Testing Entity & Corporate Domain Extraction...")
    sample_text = "I run an MSP at Apex Cyber (apexcyber.net). Contact me at brett@apexcyber.net."
    company, domain, email = extract_domain_and_company("Looking for security tool", sample_text)
    assert domain == "apexcyber.net", f"Expected apexcyber.net, got {domain}"
    assert email == "brett@apexcyber.net", f"Expected brett@apexcyber.net, got {email}"
    print(f"  [PASS] Extracted Company: {company}, Domain: {domain}, Email: {email}")

    # 3. Test Suggested Social Reply Hook
    print("\n[TEST 3] Testing Value-First Social Reply Hook Generator...")
    reply = generate_suggested_reply("dmarc_spoofing", "CloudLogix", "cloudlogix.io", title)
    assert "breachguard.io/?scan=cloudlogix.io" in reply
    assert "DMARC" in reply
    print("  [PASS] Generated personalized, non-salesy social reply hook with scanner link")

    # Setup admin auth override for API tests
    mock_admin = User(
        id=1,
        email="admin@acme.com",
        role="admin",
        org_id=1
    )
    app.dependency_overrides[get_current_user] = lambda: mock_admin

    # 4. Test Radar Signals Listing & Auto-Seeding
    print("\n[TEST 4] Testing GET /api/admin/growth/radar/signals...")
    res_signals = client.get("/api/admin/growth/radar/signals")
    assert res_signals.status_code == 200, f"Expected 200, got {res_signals.status_code}: {res_signals.text}"
    signals = res_signals.json()
    assert len(signals) >= len(PRESEEDED_SIGNALS), f"Expected >= {len(PRESEEDED_SIGNALS)} signals, got {len(signals)}"
    first_signal = signals[0]
    print(f"  [PASS] Retrieved {len(signals)} prospect signals. Top signal: [{first_signal['intent_score']}%] {first_signal['author_handle']}")

    # 5. Test 1-Click URL Ingestion
    print("\n[TEST 5] Testing POST /api/admin/growth/radar/ingest-url...")
    ingest_payload = {
        "url": "https://www.reddit.com/r/sysadmin/comments/custom_test_dmarc/",
        "text": "CEO impersonation attack targeted Acme Health (acmehealth.co) because our domain lacks DMARC enforcement. Need help ASAP.",
        "platform": "reddit"
    }
    res_ingest = client.post("/api/admin/growth/radar/ingest-url", json=ingest_payload)
    assert res_ingest.status_code == 200, f"Expected 200, got {res_ingest.status_code}: {res_ingest.text}"
    ingested_data = res_ingest.json()["signal"]
    assert ingested_data["extracted_domain"] == "acmehealth.co"
    assert ingested_data["intent_score"] >= 80
    new_signal_id = ingested_data["id"]
    print(f"  [PASS] Ingested discussion URL. Extracted domain: {ingested_data['extracted_domain']} (Score: {ingested_data['intent_score']}%)")

    # 6. Test 1-Click Convert to Lead & Auto-Scan
    print("\n[TEST 6] Testing 1-Click Conversion to OutreachLead with Passive Reconnaissance...")
    convert_payload = {
        "company_name": "Acme Health",
        "domain": "acmehealth.co",
        "contact_email": "cto@acmehealth.co",
        "contact_name": "CTO",
        "email_angle": "dmarc_spoofing",
        "auto_scan": True
    }
    res_convert = client.post(f"/api/admin/growth/radar/signals/{new_signal_id}/convert", json=convert_payload)
    assert res_convert.status_code == 200, f"Expected 200, got {res_convert.status_code}: {res_convert.text}"
    conv_data = res_convert.json()
    lead_id = conv_data["lead_id"]
    print(f"  [PASS] Successfully converted signal into OutreachLead ID {lead_id} with status '{conv_data['lead_status']}'")

    # 7. Test Google Sheets CSV Export
    print("\n[TEST 7] Testing GET /api/admin/growth/radar/export (Google Sheets CSV)...")
    res_export = client.get("/api/admin/growth/radar/export")
    assert res_export.status_code == 200, f"Expected 200, got {res_export.status_code}"
    assert "text/csv" in res_export.headers.get("content-type", "")
    csv_body = res_export.text
    assert "Company Name,Domain,Contact Email" in csv_body
    assert "acmehealth.co" in csv_body
    print(f"  [PASS] Google Sheets-ready CSV generated successfully ({len(csv_body.splitlines())} rows)")

    # 8. Test Stats Endpoint includes Radar Counts
    print("\n[TEST 8] Verifying Radar counts in GET /api/admin/growth/stats...")
    res_stats = client.get("/api/admin/growth/stats")
    assert res_stats.status_code == 200
    stats_data = res_stats.json()
    assert "total_radar_signals" in stats_data
    assert "high_intent_signals" in stats_data
    assert stats_data["total_radar_signals"] >= 1
    print(f"  [PASS] Radar metrics live in stats: {stats_data['total_radar_signals']} total, {stats_data['high_intent_signals']} high intent")

    # Clean up test lead
    client.delete(f"/api/admin/growth/leads/{lead_id}")
    app.dependency_overrides.clear()

    print("\n================================================================================")
    print("[SUCCESS] ALL BUYER INTENT RADAR VERIFICATION GATES PASSED (8/8)!")
    print("================================================================================")

if __name__ == "__main__":
    test_intent_radar()
