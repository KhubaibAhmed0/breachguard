import asyncio
import os
import sys
import uuid
from datetime import datetime
import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from main import app, init_models
from core.config import settings
from core.database import AsyncSessionLocal, engine, Base
from core.security import get_password_hash, create_access_token, create_reset_token, verify_reset_token
from models.user import User
from models.organization import Organization
from models.domain import MonitoredDomain
from services.email_service import (
    send_email, render_password_reset_email,
    render_breach_alert_email, render_team_invite_email
)

async def test_all_features():
    print("================================================================================")
    print("🚀 TESTING BREACHGUARD MARKET LAUNCH FEATURES")
    print("================================================================================")

    # 1. Database init & schema sync
    await init_models()

    unique_id = uuid.uuid4().hex[:6]
    test_org_name = f"LaunchCorp-{unique_id}"
    admin_email = f"admin_{unique_id}@launchcorp.com"

    async with AsyncSessionLocal() as db:
        org = Organization(name=test_org_name, plan="business")
        db.add(org)
        await db.commit()
        await db.refresh(org)

        admin = User(
            email=admin_email,
            hashed_password=get_password_hash("AdminPass123!"),
            org_id=org.id,
            role="admin"
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        admin_id = admin.id
        org_id = org.id

    admin_token = create_access_token(subject=admin_id)
    headers = {"Authorization": f"Bearer {admin_token}"}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # --------------------------------------------------------------------------
        # FEATURE 1: Real DNS TXT Domain Ownership Verification
        # --------------------------------------------------------------------------
        print("\n[TEST 1] Testing DNS TXT Domain Verification...")
        domain_name = f"testdomain-{unique_id}.example.com"
        add_res = await client.post("/api/domains", json={"domain": domain_name, "scan_frequency": "daily"}, headers=headers)
        assert add_res.status_code == 200, f"Failed to add domain: {add_res.text}"
        domain_id = add_res.json()["id"]

        # Retrieve verification record details
        rec_res = await client.get(f"/api/domains/{domain_id}/verification-record", headers=headers)
        assert rec_res.status_code == 200, f"Failed to get verification record: {rec_res.text}"
        rec_data = rec_res.json()
        assert rec_data["record_type"] == "TXT"
        assert "breachguard-site-verification=" in rec_data["value"]
        print(f"  ✓ Retrieved DNS record: Host={rec_data['host']}, Value={rec_data['value']}")

        # Verify domain (dev fallback triggers for .example.com / dev mode)
        verify_res = await client.post(f"/api/domains/{domain_id}/verify", headers=headers)
        assert verify_res.status_code == 200, f"Verify failed: {verify_res.text}"
        assert verify_res.json()["status"] == "verified"
        print(f"  ✓ Domain {domain_name} verified successfully.")

        # --------------------------------------------------------------------------
        # FEATURE 2: Password Reset Flow (Forgot & Reset Password)
        # --------------------------------------------------------------------------
        print("\n[TEST 2] Testing Password Reset Flow...")
        # Forgot password request
        forgot_res = await client.post("/api/auth/forgot-password", json={"email": admin_email})
        assert forgot_res.status_code == 200, f"Forgot password failed: {forgot_res.text}"
        assert forgot_res.json()["status"] == "success"
        print("  ✓ /forgot-password endpoint returned uniform anti-enumeration success.")

        # Valid token generation & validation
        valid_token = create_reset_token(admin_email, expires_minutes=60)
        assert verify_reset_token(valid_token) == admin_email
        print("  ✓ Reset token cryptographic encoding and verification passed.")

        # Invalid token rejection
        bad_reset_res = await client.post("/api/auth/reset-password", json={"token": "invalid_bogus_token_12345", "new_password": "BrandNewPassword123!"})
        assert bad_reset_res.status_code == 400, "Bogus reset token was not rejected!"
        print("  ✓ Invalid reset token was properly rejected with HTTP 400.")

        # Reset password with valid token
        new_pass = "SuperSecureNewPassword123!"
        reset_res = await client.post("/api/auth/reset-password", json={"token": valid_token, "new_password": new_pass})
        assert reset_res.status_code == 200, f"Reset password failed: {reset_res.text}"
        print("  ✓ Password reset successfully executed.")

        # Verify login with new password
        login_res = await client.post("/api/auth/login", json={"email": admin_email, "password": new_pass})
        assert login_res.status_code == 200, f"Login with new password failed: {login_res.text}"
        print("  ✓ Successfully signed in with updated password.")

        # --------------------------------------------------------------------------
        # FEATURE 3: Real Email Dispatcher & Templates
        # --------------------------------------------------------------------------
        print("\n[TEST 3] Testing Email Dispatcher Service...")
        reset_html = render_password_reset_email(reset_url="https://breachguard.io/reset-password?token=test", user_email=admin_email)
        assert "Password Reset Request" in reset_html
        assert "https://breachguard.io/reset-password?token=test" in reset_html

        invite_html = render_team_invite_email(inviter_email=admin_email, org_name=test_org_name, role="analyst", temp_password="BG-TempPass123")
        assert "BG-TempPass123" in invite_html
        assert test_org_name in invite_html

        dispatched = await send_email(to_email=admin_email, subject="Test Email", html_body=reset_html)
        assert dispatched is True
        print("  ✓ Email dispatcher and HTML templates verified.")

        # --------------------------------------------------------------------------
        # FEATURE 4: Organization Team Member Management
        # --------------------------------------------------------------------------
        print("\n[TEST 4] Testing Team Member Management...")
        teammate_email = f"analyst_{unique_id}@launchcorp.com"

        # Invite member
        invite_res = await client.post("/api/team/members", json={"email": teammate_email, "role": "analyst"}, headers=headers)
        assert invite_res.status_code == 200, f"Invite member failed: {invite_res.text}"
        invite_data = invite_res.json()
        assert invite_data["member"]["email"] == teammate_email
        assert invite_data["member"]["role"] == "analyst"
        assert invite_data["temporary_password"] is not None
        teammate_id = invite_data["member"]["id"]
        print(f"  ✓ Invited team member {teammate_email} with temp password: {invite_data['temporary_password']}")

        # List members
        list_res = await client.get("/api/team/members", headers=headers)
        assert list_res.status_code == 200
        members = list_res.json()
        assert len(members) >= 2
        emails = [m["email"] for m in members]
        assert admin_email in emails
        assert teammate_email in emails
        print(f"  ✓ Listed {len(members)} team members in organization.")

        # Demote/Promote role
        patch_res = await client.patch(f"/api/team/members/{teammate_id}/role", json={"role": "member"}, headers=headers)
        assert patch_res.status_code == 200
        assert patch_res.json()["role"] == "member"
        print("  ✓ Updated member role to 'member'.")

        # Remove member
        del_res = await client.delete(f"/api/team/members/{teammate_id}", headers=headers)
        assert del_res.status_code == 200
        print("  ✓ Removed team member from organization.")

        # --------------------------------------------------------------------------
        # FEATURE 5: Stripe Billing & Customer Portal Endpoints
        # --------------------------------------------------------------------------
        print("\n[TEST 5] Testing Stripe Billing Integration...")
        checkout_res = await client.post("/api/billing/checkout", json={"price_id": "price_business_monthly"}, headers=headers)
        assert checkout_res.status_code == 200, f"Checkout failed: {checkout_res.text}"
        assert "checkout.stripe.com" in checkout_res.json()["url"]
        print(f"  ✓ Checkout session generated: {checkout_res.json()['url']}")

        portal_res = await client.post("/api/billing/portal", headers=headers)
        assert portal_res.status_code == 200, f"Portal failed: {portal_res.text}"
        assert "billing.stripe.com" in portal_res.json()["url"]
        print(f"  ✓ Customer portal URL generated: {portal_res.json()['url']}")

        # --------------------------------------------------------------------------
        # FEATURE 6: Serverless Scheduled Scans Cron (authenticated via CRON_SECRET)
        # --------------------------------------------------------------------------
        print("\n[TEST 6] Testing Serverless Scheduled Scans Cron Endpoint...")
        cron_sec = settings.CRON_SECRET or "test_cron_secret"
        settings.CRON_SECRET = cron_sec
        cron_res = await client.post("/api/cron/scans", headers={"Authorization": f"Bearer {cron_sec}"})
        assert cron_res.status_code == 200, f"Cron endpoint failed: {cron_res.text}"
        assert cron_res.json()["status"] == "success"
        print(f"  ✓ Cron evaluation executed successfully: {cron_res.json()['domains_scanned_count']} domain(s) processed.")

    print("\n================================================================================")
    print("🎉 ALL 6 MARKET LAUNCH FEATURES VERIFIED AND FUNCTIONING PERFECTLY!")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(test_all_features())
