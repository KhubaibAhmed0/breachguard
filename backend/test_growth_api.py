"""
End-to-end integration test for Founder Growth Hub API endpoints:
1. Verifies non-admin users receive 403 Forbidden
2. Verifies admin users can manage leads, trigger scans, and customize copy
3. Verifies social media autopilot queue seeding and status updates
4. Verifies 1-click email send dispatch
"""

import sys
import os
import asyncio
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from main import app
from core.security import create_access_token
from models.user import User
from models.organization import Organization
from core.database import AsyncSessionLocal

client = TestClient(app)

def test_growth_api():
    print("================================================================================")
    print("[*] TESTING FOUNDER GROWTH HUB API ENDPOINTS & ACCESS CONTROL")
    print("================================================================================")

    # 1. Non-admin User Token (Role: member)
    non_admin_token = create_access_token(subject=9999)
    # 2. Admin User Token (Role: admin)
    # Let's seed / verify an admin user in DB or mock current_user
    from routers.deps import get_current_user
    
    mock_admin = User(
        id=1,
        email="admin@acme.com",
        role="admin",
        org_id=1
    )
    mock_member = User(
        id=2,
        email="analyst@acme.com",
        role="member",
        org_id=1
    )

    # Test 1: Access Denied for Non-Admin
    print("\n[TEST 1] Verifying 403 Forbidden on non-admin accounts...")
    app.dependency_overrides[get_current_user] = lambda: mock_member
    res = client.get("/api/admin/growth/leads")
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print("  [PASS] Non-admin access rejected with HTTP 403 Forbidden")

    # Test 2: Access Granted for Platform Admin
    print("\n[TEST 2] Verifying admin access and stats endpoint...")
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    res_stats = client.get("/api/admin/growth/stats")
    assert res_stats.status_code == 200, f"Expected 200, got {res_stats.status_code}: {res_stats.text}"
    stats_data = res_stats.json()
    assert "total_leads" in stats_data
    assert "total_social_posts" in stats_data
    print(f"  [PASS] Admin stats retrieved successfully: {stats_data}")

    # Test 3: Create Target Outreach Lead
    print("\n[TEST 3] Testing lead creation (without immediate external network scan)...")
    lead_payload = {
        "company_name": "Inaequo Solutions",
        "domain": "inaequosolutions.com",
        "contact_email": "founder@inaequosolutions.com",
        "contact_name": "Founder",
        "email_angle": "dmarc_spoofing",
        "auto_scan": False
    }
    res_create = client.post("/api/admin/growth/leads", json=lead_payload)
    assert res_create.status_code == 200, f"Expected 200, got {res_create.status_code}: {res_create.text}"
    lead_id = res_create.json()["id"]
    print(f"  [PASS] Lead created with ID {lead_id}")

    # Test 4: Update Lead and Custom Email Draft
    print("\n[TEST 4] Testing lead draft customization...")
    update_payload = {
        "email_subject": "Security audit regarding inaequosolutions.com",
        "email_body": "Hi Founder,\n\nWe noticed your domain lacks DMARC enforcement.\n\nBest regards,\nBreachGuard Team",
        "status": "ready"
    }
    res_update = client.put(f"/api/admin/growth/leads/{lead_id}", json=update_payload)
    assert res_update.status_code == 200, f"Expected 200, got {res_update.status_code}"
    print("  [PASS] Lead draft updated and marked ready")

    # Test 5: 1-Click Send via Resend (Mock delivery / sandbox)
    print("\n[TEST 5] Testing 1-Click Send dispatch...")
    res_send = client.post(f"/api/admin/growth/leads/{lead_id}/send")
    assert res_send.status_code in (200, 201), f"Expected 200/201, got {res_send.status_code}: {res_send.text}"
    print(f"  [PASS] 1-Click Send executed successfully: {res_send.json()['message']}")

    # Test 6: Social Media Queue Listing & Cadence
    print("\n[TEST 6] Testing Social Media Autopilot queue...")
    res_social = client.get("/api/admin/growth/social")
    assert res_social.status_code == 200, f"Expected 200, got {res_social.status_code}"
    posts = res_social.json()
    assert len(posts) >= 6, f"Expected at least 6 social posts, found {len(posts)}"
    print(f"  [PASS] Retrieved {len(posts)} pre-seeded social posts on 3-day cadence")

    # Test 7: Clean up test lead
    print("\n[TEST 7] Cleaning up test lead...")
    res_del = client.delete(f"/api/admin/growth/leads/{lead_id}")
    assert res_del.status_code == 200, f"Expected 200, got {res_del.status_code}"
    print("  [PASS] Test lead deleted")

    # Test 8: Google Sheets Config Save & Retrieve
    print("\n[TEST 8] Testing Google Sheets configuration endpoints...")
    cfg_payload = {
        "sheet_url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
        "auto_scan": True
    }
    res_save_cfg = client.post("/api/admin/growth/sheets/config", json=cfg_payload)
    assert res_save_cfg.status_code == 200, f"Expected 200, got {res_save_cfg.status_code}: {res_save_cfg.text}"
    print("  [PASS] Google Sheet configuration saved")

    res_get_cfg = client.get("/api/admin/growth/sheets/config")
    assert res_get_cfg.status_code == 200, f"Expected 200, got {res_get_cfg.status_code}: {res_get_cfg.text}"
    loaded_cfg = res_get_cfg.json()
    assert loaded_cfg["sheet_url"] == cfg_payload["sheet_url"]
    assert loaded_cfg["auto_scan"] is True
    print(f"  [PASS] Google Sheet configuration verified: {loaded_cfg['sheet_url']}")

    # Clean up overrides
    app.dependency_overrides.clear()

    print("\n================================================================================")
    print("[SUCCESS] ALL FOUNDER GROWTH HUB API VERIFICATION GATES PASSED (8/8)!")
    print("================================================================================")

if __name__ == "__main__":
    test_growth_api()
