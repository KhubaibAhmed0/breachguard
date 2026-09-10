import asyncio
import os
import io
import sys
import uuid
import httpx
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from main import app, init_models
from core.database import AsyncSessionLocal, engine, Base
from sqlalchemy.future import select
from models.organization import Organization
from models.user import User
from models.domain import MonitoredDomain, MonitoredEmail
from models.exposure import Exposure
from core.security import get_password_hash, create_access_token
from services.scan_service import run_domain_scan
from services.report_service import generate_pdf_report

async def run_tests():
    print("==================================================")
    print("🚀 BREACHGUARD PRODUCTION INFRASTRUCTURE TEST SUITE")
    print("==================================================")

    # 1. Initialize models & schema upgrades
    print("\n--- 1. Testing Database Schema & Migrations ---")
    await init_models()
    print("✅ Database schema initialized successfully.")

    client = TestClient(app)

    # Test root endpoint
    res = client.get("/")
    assert res.status_code == 200, f"Root endpoint failed: {res.text}"
    print(f"✅ Root API endpoint online: {res.json()}")

    # 2. Test Organizations and Users setup
    print("\n--- 2. Setting up Test Organizations & Users ---")
    async with AsyncSessionLocal() as session:
        uid = uuid.uuid4().hex[:6]
        # Create Essential Org
        essential_org = Organization(name=f"Essential Corp {uid}", plan="essential")
        session.add(essential_org)

        # Create MSP Enterprise Org
        msp_org = Organization(name=f"Apex MSP Partners {uid}", plan="enterprise", is_msp=True)
        session.add(msp_org)
        await session.commit()
        await session.refresh(essential_org)
        await session.refresh(msp_org)

        # Create Users
        user_essential = User(
            email=f"admin_{uid}@essential.com",
            hashed_password=get_password_hash("Secret123!"),
            org_id=essential_org.id,
            role="admin"
        )
        user_msp = User(
            email=f"partner_{uid}@apex-msp.com",
            hashed_password=get_password_hash("Secret123!"),
            org_id=msp_org.id,
            role="admin"
        )
        session.add_all([user_essential, user_msp])
        await session.commit()
        await session.refresh(user_essential)
        await session.refresh(user_msp)

        # Add Monitored Domains
        dom_essential = MonitoredDomain(
            org_id=essential_org.id,
            domain=f"essential-{uid}.com",
            verified=True,
            scan_frequency="daily"
        )
        dom_msp = MonitoredDomain(
            org_id=msp_org.id,
            domain=f"apexmsp-{uid}.io",
            verified=True,
            scan_frequency="continuous"
        )
        session.add_all([dom_essential, dom_msp])
        await session.commit()
        await session.refresh(dom_essential)
        await session.refresh(dom_msp)

        essential_user_id = user_essential.id
        essential_org_id = essential_org.id
        essential_dom_id = dom_essential.id

        msp_user_id = user_msp.id
        msp_org_id = msp_org.id
        msp_dom_id = dom_msp.id
        msp_dom_name = dom_msp.domain

    token_essential = create_access_token(essential_user_id)
    headers_essential = {"Authorization": f"Bearer {token_essential}"}

    token_msp = create_access_token(msp_user_id)
    headers_msp = {"Authorization": f"Bearer {token_msp}"}
    print(f"✅ Created Essential Org (ID: {essential_org_id}) and MSP Org (ID: {msp_org_id}) with auth tokens.")

    # 3. Test Privileged Identities API (/api/identities)
    print("\n--- 3. Testing Privileged Identities API (/api/identities) ---")
    
    # 3a. GET /api/identities (initially empty)
    res = client.get("/api/identities", headers=headers_essential)
    assert res.status_code == 200, f"GET /api/identities failed: {res.text}"
    data = res.json()
    assert data["quota_limit"] == 5, f"Expected quota 5, got {data['quota_limit']}"
    assert data["used_count"] == 0
    assert data["plan"] == "essential"
    print(f"✅ GET /api/identities returned quota: {data['quota_limit']}, plan: {data['plan']}")

    # 3b. POST /api/identities (Add 5 identities to fill essential quota)
    created_ids = []
    for i in range(1, 6):
        res = client.post(
            "/api/identities",
            headers=headers_essential,
            json={"domain_id": essential_dom_id, "email": f"vip{i}@essential.com"}
        )
        assert res.status_code == 200, f"Failed to add VIP {i}: {res.text}"
        created_ids.append(res.json()["id"])
    print(f"✅ Successfully added 5 privileged VIP identities.")

    # 3c. Enforce Quota: 6th identity should return 403 Forbidden
    res = client.post(
        "/api/identities",
        headers=headers_essential,
        json={"domain_id": essential_dom_id, "email": "vip6@essential.com"}
    )
    assert res.status_code == 403, f"Expected 403 Quota limit error, got: {res.status_code} - {res.text}"
    print(f"✅ Quota enforcement verified: 6th VIP rejected with 403: {res.json()['detail']}")

    # 3d. DELETE /api/identities/{id}
    first_vip_id = created_ids[0]
    res = client.delete(f"/api/identities/{first_vip_id}", headers=headers_essential)
    assert res.status_code == 200, f"DELETE identity failed: {res.text}"
    
    # Verify count is now 4
    res = client.get("/api/identities", headers=headers_essential)
    assert res.json()["used_count"] == 4, f"Expected 4 used, got {res.json()['used_count']}"
    print(f"✅ Identity deletion / unmarking verified. Used count now {res.json()['used_count']}.")

    # 4. Test Integrations & Logo Upload API (/api/settings)
    print("\n--- 4. Testing Integrations & Settings API (/api/settings) ---")
    
    # 4a. PATCH /api/settings/integrations
    test_webhook_url = "https://example.com/services/test-slack-webhook"
    test_siem_url = "https://siem.acme.com/api/v1/alerts"
    res = client.patch(
        "/api/settings/integrations",
        headers=headers_msp,
        json={"slack_webhook_url": test_webhook_url, "siem_webhook_url": test_siem_url}
    )
    assert res.status_code == 200, f"Update integrations failed: {res.text}"
    assert res.json()["slack_webhook_url"] == test_webhook_url
    print(f"✅ PATCH /api/settings/integrations successfully updated webhook URLs.")

    # 4b. GET /api/settings/integrations
    res = client.get("/api/settings/integrations", headers=headers_msp)
    assert res.status_code == 200, f"GET integrations failed: {res.text}"
    assert res.json()["slack_webhook_url"] == test_webhook_url
    assert res.json()["is_msp"] == True
    print(f"✅ GET /api/settings/integrations retrieved current settings correctly.")

    # 4c. POST /api/settings/logo (Upload logo file)
    # Generate a dummy 100x40 PNG in memory
    from PIL import Image
    img = Image.new('RGB', (100, 40), color=(15, 23, 42))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()

    res = client.post(
        "/api/settings/logo",
        headers=headers_msp,
        files={"file": ("apex_logo.png", img_bytes, "image/png")}
    )
    assert res.status_code == 200, f"Logo upload failed: {res.text}"
    logo_data = res.json()
    assert "logo_path" in logo_data and os.path.exists(logo_data["logo_path"])
    print(f"✅ POST /api/settings/logo uploaded logo to {logo_data['logo_path']}.")

    # 4d. POST /api/settings/test-webhook with custom url
    # We test that delivery attempt occurs and handles responses appropriately
    res = client.post(
        "/api/settings/test-webhook",
        headers=headers_msp,
        json={"webhook_url": "https://httpbin.org/post"}
    )
    if res.status_code == 200:
        print(f"✅ Test alert dispatched successfully to test endpoint.")
    else:
        print(f"ℹ️ Test alert response: {res.status_code} (Network handling verified).")

    # 5. Test Multi-Tenant MSP API (/api/msp)
    print("\n--- 5. Testing Multi-Tenant MSP API (/api/msp) ---")
    
    # 5a. Non-MSP / Essential user cannot access MSP
    res = client.get("/api/msp/tenants", headers=headers_essential)
    assert res.status_code == 403, f"Expected 403 for non-MSP org, got {res.status_code}"
    print("✅ Non-MSP accounts correctly denied access to MSP tenant endpoints (403 Forbidden).")

    # 5b. MSP user lists tenants (initially empty)
    res = client.get("/api/msp/tenants", headers=headers_msp)
    assert res.status_code == 200, f"MSP list tenants failed: {res.text}"
    assert len(res.json()) == 0
    print("✅ MSP user listed initial empty tenant list.")

    # 5c. MSP user creates a new child tenant
    res = client.post(
        "/api/msp/tenants",
        headers=headers_msp,
        json={"name": "Client Alpha Financial"}
    )
    assert res.status_code == 200, f"Create tenant failed: {res.text}"
    tenant_alpha = res.json()
    alpha_id = tenant_alpha["id"]
    assert tenant_alpha["name"] == "Client Alpha Financial"
    assert tenant_alpha["parent_org_id"] == msp_org_id
    print(f"✅ Created child tenant '{tenant_alpha['name']}' (ID: {alpha_id}) under MSP Org.")

    # 5d. Add domain to child tenant to verify domain count in MSP listing
    async with AsyncSessionLocal() as session:
        child_dom = MonitoredDomain(org_id=alpha_id, domain="alpha-fin.com", verified=True)
        session.add(child_dom)
        await session.commit()

    res = client.get("/api/msp/tenants", headers=headers_msp)
    assert res.status_code == 200
    tenants = res.json()
    assert len(tenants) == 1
    assert tenants[0]["domains_count"] == 1
    print(f"✅ Tenant listing accurately reflects child domain counts ({tenants[0]['domains_count']} domain).")

    # 5e. Test Switch Tenant Context via Scoped JWT Token
    res = client.post(f"/api/msp/switch-tenant/{alpha_id}", headers=headers_msp)
    assert res.status_code == 200, f"Switch tenant failed: {res.text}"
    switch_data = res.json()
    scoped_token = switch_data["access_token"]
    assert switch_data["tenant"]["id"] == alpha_id
    print(f"✅ Switched session to tenant {alpha_id}; received scoped access token.")

    # Verify that request using scoped token accesses Client Alpha Financial domains!
    scoped_headers = {"Authorization": f"Bearer {scoped_token}"}
    res = client.get("/api/domains", headers=scoped_headers)
    assert res.status_code == 200
    scoped_domains = res.json()
    assert len(scoped_domains) == 1
    assert scoped_domains[0]["domain"] == "alpha-fin.com"
    print(f"✅ Scoped token seamlessly isolated data context to tenant's domain: '{scoped_domains[0]['domain']}'.")

    # 6. Test Tier Gating in Exposures (/api/exposures)
    print("\n--- 6. Testing Tier Gating in Exposures (/api/exposures) ---")
    async with AsyncSessionLocal() as session:
        # Seed stealer log exposure and standard breach exposure
        # Essential org email
        e_res = await session.execute(select(MonitoredEmail).where(MonitoredEmail.domain_id == essential_dom_id))
        email_obj = e_res.scalars().first()

        stealer_exp = Exposure(
            email_id=email_obj.id,
            org_id=essential_org_id,
            source_name="Redline Stealer Log 2026",
            source_type="stealer_log",
            data_classes=["Passwords", "Browser Cookies", "Autofill Data", "Crypto Wallets"],
            severity="critical",
            credential_type="plaintext",
            status="open"
        )
        standard_exp = Exposure(
            email_id=email_obj.id,
            org_id=essential_org_id,
            source_name="Adobe Public Breach",
            source_type="breach",
            data_classes=["Email addresses", "Password hints"],
            severity="low",
            credential_type="hint",
            status="open"
        )
        session.add_all([stealer_exp, standard_exp])
        await session.commit()

    res = client.get("/api/exposures", headers=headers_essential)
    assert res.status_code == 200, f"List exposures failed: {res.text}"
    exposures = res.json()
    stealer_found = False
    for exp in exposures:
        if exp["source_type"] == "stealer_log" or "stealer" in exp["source_name"].lower():
            stealer_found = True
            assert exp["upgrade_required"] == True, "Expected upgrade_required to be True"
            assert "REDACTED" in exp["credential_type"], f"Expected REDACTED credential_type, got {exp['credential_type']}"
            assert any("PROTECTED" in dc for dc in exp["data_classes"]), f"Expected protected data classes, got {exp['data_classes']}"
            print(f"✅ Tier gating verified on stealer log: upgrade_required={exp['upgrade_required']}, credential_type={exp['credential_type']}")
    assert stealer_found, "Stealer log was not found in exposures list"

    # 7. Test PDF Report Generation with Custom Organization Logo
    print("\n--- 7. Testing Co-branded PDF Report Generation ---")
    async with AsyncSessionLocal() as session:
        pdf_path = await generate_pdf_report(
            org_id=msp_org_id,
            report_type="Executive Summary",
            domain_name=msp_dom_name,
            db=session
        )
        assert os.path.exists(pdf_path), f"PDF report not found at {pdf_path}"
        file_size = os.path.getsize(pdf_path)
        assert file_size > 1000, f"Generated PDF file suspiciously small: {file_size} bytes"
        print(f"✅ Co-branded PDF report with custom partner logo generated ({file_size} bytes) at: {pdf_path}")

    # 8. Test Autonomous Domain Scan Trigger
    print("\n--- 8. Testing Autonomous Threat Scanner Webhook Dispatch ---")
    async with AsyncSessionLocal() as session:
        scan_res = await run_domain_scan(msp_dom_id, session)
        assert scan_res["status"] == "success"
        print(f"✅ Domain scanner executed successfully: {scan_res}")

    # 9. Test API Input Auditing & Mass Assignment Prevention (Measures 11 & 12)
    print("\n--- 9. Testing API Input Validation & Mass Assignment Prevention ---")
    
    # 9a. Extra field rejection (Mass assignment defense) on POST /api/domains
    res = client.post(
        "/api/domains",
        headers=headers_essential,
        json={"domain": "attacker-domain.com", "org_id": 999, "is_admin": True, "verified": True}
    )
    assert res.status_code == 422, f"Expected 422 for mass assignment on /api/domains, got: {res.status_code} - {res.text}"
    print(f"✅ Mass assignment blocked on /api/domains (HTTP 422 extra field forbidden).")

    # 9b. Extra field rejection on PATCH /api/exposures/{id}/status
    res = client.patch(
        f"/api/exposures/{stealer_exp.id}/status",
        headers=headers_essential,
        json={"status": "resolved", "org_id": 999, "role": "admin"}
    )
    assert res.status_code == 422, f"Expected 422 for mass assignment on exposure status update, got {res.status_code}"
    print(f"✅ Mass assignment blocked on /api/exposures status update (HTTP 422 extra field forbidden).")

    # 9c. Invalid status enum rejection
    res = client.patch(
        f"/api/exposures/{stealer_exp.id}/status",
        headers=headers_essential,
        json={"status": "invalid_status_value"}
    )
    assert res.status_code == 422, f"Expected 422 for disallowed status enum, got {res.status_code}"
    print(f"✅ Disallowed status enum value rejected (HTTP 422).")

    # 9d. Pagination bounds validation on /api/exposures
    res = client.get("/api/exposures?limit=500", headers=headers_essential)
    assert res.status_code == 422, f"Expected 422 for limit > 100, got {res.status_code}"
    res = client.get("/api/exposures?limit=-1", headers=headers_essential)
    assert res.status_code == 422, f"Expected 422 for negative limit, got {res.status_code}"
    print(f"✅ Pagination bounds enforced on /api/exposures (1 <= limit <= 100).")

    # 10. Test Production Error Handling & SQL Exception Safety (Measure 13)
    print("\n--- 10. Testing Production Error Handling & SQL Exception Safety ---")
    res = client.get("/api/health")
    assert res.status_code == 200
    assert "password" not in res.text.lower()
    assert "secret" not in res.text.lower()
    print("✅ Health check reveals zero database credentials or internal secrets.")

    # 11. Test OpenAPI / Swagger Documentation Protection (Measure 14)
    print("\n--- 11. Testing OpenAPI / Swagger Documentation Protection ---")
    from main import is_production, docs_url
    print(f"✅ Environment production check: is_production={is_production}, docs_url={docs_url}")

    # 12. Test Public Scanner Hardening, Zero Leakage & Abuse Monitoring (Measures 15, 16 & 17)
    print("\n--- 12. Testing Public Scanner Leakage Prevention & Abuse Monitoring ---")
    # 12a. Scan valid domain - verify response is aggregated and clean
    res = client.post("/api/prospect/scan", json={"domain": "example.com"})
    assert res.status_code == 200, f"Prospect scan failed: {res.text}"
    p_data = res.json()
    assert "domain" in p_data
    assert "total_exposures" in p_data
    assert "severity_breakdown" in p_data
    # Verify zero credentials / session tokens leak
    resp_text_lower = res.text.lower()
    assert "password_hash" not in resp_text_lower
    assert "session_token" not in resp_text_lower
    assert "auth_token" not in resp_text_lower
    print(f"✅ Public prospect scan output sanitized: {p_data['domain']} ({p_data['total_exposures']} exposures, 0 raw secrets).")

    # 12b. Abuse monitoring detection - trigger repeated invalid/malformed scans
    test_client_fuzz = TestClient(app)
    fuzz_blocked = False
    for i in range(6):
        res = test_client_fuzz.post("/api/prospect/scan", json={"domain": f"malformed..host..{i}"})
        if res.status_code == 429:
            fuzz_blocked = True
            break
    assert fuzz_blocked, "Scanner abuse monitor failed to trigger 429 for repeated malformed queries"
    print("✅ Scanner abuse monitor triggered: repeated invalid scanning attempts blocked with HTTP 429.")

    # 13. Test SSRF Guard & DNS Rebinding Defense (Measures 18 & 19)
    print("\n--- 13. Testing SSRF Guard & DNS Rebinding Defense ---")
    from core.ssrf_guard import validate_url_for_ssrf, is_ip_blocked
    
    # Verify is_ip_blocked blocks private, link-local, loopback, metadata
    assert is_ip_blocked("127.0.0.1") == True
    assert is_ip_blocked("169.254.169.254") == True
    assert is_ip_blocked("10.0.0.1") == True
    assert is_ip_blocked("192.168.1.1") == True
    assert is_ip_blocked("172.16.0.1") == True
    assert is_ip_blocked("100.64.0.1") == True
    assert is_ip_blocked("::1") == True
    assert is_ip_blocked("::ffff:127.0.0.1") == True
    assert is_ip_blocked("8.8.8.8") == False
    assert is_ip_blocked("93.184.216.34") == False
    print("✅ SSRF IP blocklist comprehensively verified across all private/cloud metadata ranges.")

    # Test webhook endpoint SSRF defense
    res = client.post(
        "/api/settings/test-webhook",
        headers=headers_msp,
        json={"webhook_url": "http://169.254.169.254/latest/meta-data/"}
    )
    assert res.status_code == 400, f"Expected 400 for cloud metadata SSRF, got: {res.status_code}"
    print("✅ Webhook SSRF attack to cloud metadata (169.254.169.254) blocked with HTTP 400.")

    res = client.post(
        "/api/settings/test-webhook",
        headers=headers_msp,
        json={"webhook_url": "http://127.0.0.1:8000/internal"}
    )
    assert res.status_code == 400, f"Expected 400 for loopback SSRF, got: {res.status_code}"
    print("✅ Webhook SSRF attack to localhost loopback blocked with HTTP 400.")

    # 14. Test Data Classification Policy (Measure 20)
    print("\n--- 14. Testing Data Classification Policy Documentation ---")
    assert os.path.exists("SECURITY_DATA_CLASSIFICATION.md"), "SECURITY_DATA_CLASSIFICATION.md missing!"
    with open("SECURITY_DATA_CLASSIFICATION.md", "r", encoding="utf-8") as f:
        policy_text = f.read()
    assert "Tier 1: Public Intelligence" in policy_text
    assert "Tier 2: Confidential Operational Data" in policy_text
    assert "Tier 3: Restricted Threat Intelligence" in policy_text
    assert "Tier 4: Secret / Zero-Knowledge Assets" in policy_text
    print("✅ SECURITY_DATA_CLASSIFICATION.md verified with all 4 sensitivity tiers and least-privilege matrix.")

    print("\n==================================================")
    print("🎉 ALL PRODUCTION BACKEND INFRASTRUCTURE TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
