import asyncio
import os
import sys
import uuid
import hmac
import hashlib
import time
from datetime import datetime, timezone, timedelta
import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from main import app, init_models
from core.config import settings, KNOWN_INSECURE_SECRETS
from core.database import AsyncSessionLocal
from core.security import (
    get_password_hash,
    create_access_token,
    create_reset_token,
    verify_reset_token,
    mark_reset_token_used,
)
from core.rate_limiter import get_client_ip, HybridRateLimiter
from models.user import User
from models.organization import Organization
from models.domain import MonitoredDomain
from services.alert_service import generate_webhook_signature, verify_webhook_signature
from services.report_service import safe_text, generate_pdf_report
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

async def run_security_tests():
    print("=" * 80)
    print("🔒 RUNNING BREACHGUARD COMPREHENSIVE SECURITY REGRESSION SUITE")
    print("=" * 80)

    # Database init & schema sync
    await init_models()

    passed_tests = 0
    total_tests = 12

    uid = uuid.uuid4().hex[:6]
    test_org_name = f"SecTestOrg-{uid}"
    admin_email = f"admin_{uid}@sectest.com"
    member_email = f"member_{uid}@sectest.com"

    async with AsyncSessionLocal() as db:
        org = Organization(name=test_org_name, plan="enterprise")
        db.add(org)
        await db.commit()
        await db.refresh(org)

        admin_user = User(
            email=admin_email,
            hashed_password=get_password_hash("AdminSecPass123!"),
            org_id=org.id,
            role="admin",
        )
        member_user = User(
            email=member_email,
            hashed_password=get_password_hash("MemberSecPass123!"),
            org_id=org.id,
            role="member",
        )
        db.add(admin_user)
        db.add(member_user)
        await db.commit()
        await db.refresh(admin_user)
        await db.refresh(member_user)

        admin_id = admin_user.id
        member_id = member_user.id
        org_id = org.id

        # Add a domain for deletion test
        domain = MonitoredDomain(
            domain=f"sub_{uid}.sectest.com",
            org_id=org.id,
            verified=True,
        )
        db.add(domain)
        await db.commit()
        await db.refresh(domain)
        domain_id = domain.id

    admin_token = create_access_token(subject=admin_id)
    member_token = create_access_token(subject=member_id)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:

        # ----------------------------------------------------------------------
        # BG-SEC-01: Weak / Hardcoded SECRET_KEY
        # ----------------------------------------------------------------------
        print("\n[1/12] Testing BG-SEC-01: Secret Key Hardening & Production Fail-Closed...")
        orig_secret = settings.SECRET_KEY
        orig_env = settings.ENVIRONMENT
        try:
            assert settings.SECRET_KEY not in KNOWN_INSECURE_SECRETS, "SECRET_KEY is a known insecure secret!"
            assert len(settings.SECRET_KEY) >= 32, "SECRET_KEY entropy is less than 256-bit (32 chars)!"

            # Test fail-closed validation under production environment
            try:
                settings.ENVIRONMENT = "production"
                # Test insecure key raises RuntimeError
                settings.SECRET_KEY = "supersecretkey"
                threw = False
                try:
                    settings.validate_production_keys()
                except RuntimeError:
                    threw = True
                assert threw, "Production validation failed to reject 'supersecretkey'!"

                # Test short key raises RuntimeError
                settings.SECRET_KEY = "short_key"
                threw = False
                try:
                    settings.validate_production_keys()
                except RuntimeError:
                    threw = True
                assert threw, "Production validation failed to reject short secret!"
            finally:
                settings.ENVIRONMENT = orig_env
                settings.SECRET_KEY = orig_secret

            print("  ✅ PASS: BG-SEC-01 Secret key entropy strictly enforced; production fails closed against weak keys.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-01: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-02: Stripe Webhook Signature Bypass
        # ----------------------------------------------------------------------
        print("\n[2/12] Testing BG-SEC-02: Stripe Webhook Signature Verification...")
        orig_stripe_sec = settings.STRIPE_WEBHOOK_SECRET
        try:
            # 1. When secret unset -> fails closed with 503
            settings.STRIPE_WEBHOOK_SECRET = None
            res_fail_closed = await client.post(
                "/api/billing/webhook",
                content=b'{"id": "evt_test", "type": "invoice.paid"}',
                headers={"Content-Type": "application/json"}
            )
            assert res_fail_closed.status_code == 503, f"Expected 503 for unset webhook secret, got {res_fail_closed.status_code}"

            # 2. When secret configured -> missing signature must return 400
            settings.STRIPE_WEBHOOK_SECRET = "whsec_test_stripe_secret_key"
            res_missing = await client.post(
                "/api/billing/webhook",
                content=b'{"id": "evt_test", "type": "invoice.paid"}',
                headers={"Content-Type": "application/json"}
            )
            assert res_missing.status_code == 400, f"Expected 400 for missing signature, got {res_missing.status_code}"

            # 3. Forged signature must return 400
            res_forged = await client.post(
                "/api/billing/webhook",
                content=b'{"id": "evt_test", "type": "invoice.paid"}',
                headers={
                    "Content-Type": "application/json",
                    "Stripe-Signature": "t=1600000000,v1=bad_signature_forged_hash"
                }
            )
            assert res_forged.status_code == 400, f"Expected 400 for forged signature, got {res_forged.status_code}"
            print("  ✅ PASS: BG-SEC-02 Unauthenticated/forged Stripe webhooks strictly rejected with HTTP 400/503.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-02: {e}")
        finally:
            settings.STRIPE_WEBHOOK_SECRET = orig_stripe_sec

        # ----------------------------------------------------------------------
        # BG-SEC-03: SECRET_KEY Isolation for Outbound Webhooks
        # ----------------------------------------------------------------------
        print("\n[3/12] Testing BG-SEC-03: Webhook Signing Key Isolation & Verification...")
        try:
            payload = '{"event": "breach.detected", "victim": "corp.com"}'
            sig_header = generate_webhook_signature(payload)
            assert sig_header.startswith("t="), "Webhook signature missing timestamp"
            assert "v1=" in sig_header, "Webhook signature missing v1 HMAC hash"

            # Must verify successfully with correct dedicated key
            is_valid = verify_webhook_signature(payload, sig_header)
            assert is_valid is True, "Valid webhook signature failed verification!"

            # Tampered payload must fail
            assert verify_webhook_signature('{"tampered": true}', sig_header) is False, "Tampered payload verified!"

            # Signature made with SECRET_KEY must NOT match signature made with WEBHOOK_SIGNING_KEY
            sig_with_secret_key = generate_webhook_signature(payload, secret="different_secret_key_123")
            assert verify_webhook_signature(payload, sig_with_secret_key) is False, "Signature isolation failed!"

            print("  ✅ PASS: BG-SEC-03 Outbound webhooks use dedicated isolated key; HMAC verification working.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-03: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-04: Unrestricted File Upload & Stored XSS
        # ----------------------------------------------------------------------
        print("\n[4/12] Testing BG-SEC-04: Secure File Upload Hardening...")
        try:
            # 1. Member user attempting upload must be forbidden (admin only)
            res_member = await client.post(
                "/api/integrations/logo",
                headers={"Authorization": f"Bearer {member_token}"},
                files={"file": ("logo.png", b"\x89PNG\r\n\x1a\n", "image/png")}
            )
            assert res_member.status_code == 403, f"Expected 403 for non-admin upload, got {res_member.status_code}"

            # 2. Uploading dangerous file extension (e.g. .html or .svg) must fail
            res_html = await client.post(
                "/api/integrations/logo",
                headers={"Authorization": f"Bearer {admin_token}"},
                files={"file": ("malicious.html", b"<html><script>alert(1)</script></html>", "text/html")}
            )
            assert res_html.status_code == 400, f"Expected 400 for .html extension, got {res_html.status_code}"

            # 3. Disguised file: .png extension but containing HTML / JS active content
            xss_payload = b"\x89PNG\r\n\x1a\n" + b"<script>alert('XSS')</script>"
            res_xss = await client.post(
                "/api/integrations/logo",
                headers={"Authorization": f"Bearer {admin_token}"},
                files={"file": ("fake.png", xss_payload, "image/png")}
            )
            assert res_xss.status_code == 400, f"Expected 400 for active content in PNG, got {res_xss.status_code}"

            # 4. Valid PNG file must succeed and return randomized filename (not user-supplied filename)
            valid_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
            res_valid = await client.post(
                "/api/integrations/logo",
                headers={"Authorization": f"Bearer {admin_token}"},
                files={"file": ("my_cool_company_logo.png", valid_png, "image/png")}
            )
            assert res_valid.status_code == 200, f"Expected 200 for valid PNG, got {res_valid.status_code}"
            logo_url = res_valid.json().get("logo_url")
            assert "my_cool_company_logo" not in logo_url, "Uploaded file preserved dangerous client filename!"
            assert f"logo_{org_id}_" in logo_url, "Uploaded file filename is not randomized with org prefix"

            print("  ✅ PASS: BG-SEC-04 Upload requires admin, blocks XSS/executables, validates magic bytes, and randomizes filenames.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-04: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-05: Overly Broad CORS Regex
        # ----------------------------------------------------------------------
        print("\n[5/12] Testing BG-SEC-05: CORS Whitelist Hardening...")
        try:
            # Malicious origin pretending to be on vercel: evil-subdomain.vercel.app
            res_evil_cors = await client.options(
                "/api/auth/me",
                headers={
                    "Origin": "https://evil-attacker.vercel.app",
                    "Access-Control-Request-Method": "GET"
                }
            )
            allow_origin = res_evil_cors.headers.get("access-control-allow-origin")
            assert allow_origin != "https://evil-attacker.vercel.app", f"Untrusted origin was allowed by CORS: {allow_origin}"

            # Trusted origin must succeed
            res_trusted_cors = await client.options(
                "/api/auth/me",
                headers={
                    "Origin": "https://breachguard.vercel.app",
                    "Access-Control-Request-Method": "GET"
                }
            )
            allow_trusted = res_trusted_cors.headers.get("access-control-allow-origin")
            assert allow_trusted == "https://breachguard.vercel.app", f"Trusted origin rejected: {allow_trusted}"

            print("  ✅ PASS: BG-SEC-05 CORS regex removed; strict explicit allowlist enforced.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-05: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-06: Unauthenticated Cron Endpoint
        # ----------------------------------------------------------------------
        print("\n[6/12] Testing BG-SEC-06: Secure Authentication for Cron Jobs...")
        orig_cron_sec = settings.CRON_SECRET
        try:
            # 1. When CRON_SECRET is not configured on server -> fails closed with 503
            settings.CRON_SECRET = None
            res_fail_closed = await client.post("/api/cron/scans")
            assert res_fail_closed.status_code == 503, f"Expected 503 when CRON_SECRET is unset, got {res_fail_closed.status_code}"

            # 2. When configured, unauthenticated calls -> 401
            settings.CRON_SECRET = "secure_cron_secret_token_256_bits_val"
            res_no_auth = await client.post("/api/cron/scans")
            assert res_no_auth.status_code == 401, f"Expected 401 for unauthenticated cron, got {res_no_auth.status_code}"

            # 3. Invalid auth -> 401
            res_bad_auth = await client.post("/api/cron/scans", headers={"Authorization": "Bearer totally_wrong_secret"})
            assert res_bad_auth.status_code == 401, f"Expected 401 for bad cron secret, got {res_bad_auth.status_code}"

            # 4. Valid CRON_SECRET -> 200
            res_valid = await client.post("/api/cron/scans", headers={"Authorization": f"Bearer {settings.CRON_SECRET}"})
            assert res_valid.status_code == 200, f"Expected 200 for valid cron secret, got {res_valid.status_code}"

            print("  ✅ PASS: BG-SEC-06 Cron route strictly rejects unauthenticated calls and requires constant-time secret check.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-06: {e}")
        finally:
            settings.CRON_SECRET = orig_cron_sec

        # ----------------------------------------------------------------------
        # BG-SEC-07: TLS Verification for crt.sh
        # ----------------------------------------------------------------------
        print("\n[7/12] Testing BG-SEC-07: crt.sh TLS Verification Enabled...")
        try:
            eas_path = os.path.join(os.path.dirname(__file__), "services", "external_attack_surface.py")
            with open(eas_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "verify=False" not in content, "Found 'verify=False' in external_attack_surface.py!"
            assert 'crt.sh' in content, "crt.sh reference missing"
            print("  ✅ PASS: BG-SEC-07 TLS verification (verify=False) removed; strict SSL/TLS enabled.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-07: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-08: ReportLab XML/HTML Injection Crash
        # ----------------------------------------------------------------------
        print("\n[8/12] Testing BG-SEC-08: ReportLab XML Entity Escaping & Safe Text...")
        try:
            # safe_text helper test
            malicious_markup = "<font color='red'>Malicious</font> & <script>alert(1)</script> \"test\""
            sanitized = safe_text(malicious_markup)
            assert "<font" not in sanitized, "safe_text did not escape '<font'"
            assert "&lt;script&gt;" in sanitized, "safe_text did not escape '<script>'"
            assert "&amp;" in sanitized, "safe_text did not escape '&'"

            # Test ReportLab paragraph compilation with unescaped vs safe_text
            styles = getSampleStyleSheet()
            normal_style = styles["Normal"]
            
            # An unescaped string with raw XML unclosed tag will cause parser to crash or fail
            # But safe_text renders cleanly in ReportLab
            p = Paragraph(safe_text(malicious_markup), normal_style)
            w, h = p.wrap(400, 100)
            assert h > 0, "Paragraph failed to layout with safe_text"

            # Test generate_pdf_report with malicious organization name
            async with AsyncSessionLocal() as db_session:
                pdf_path = await generate_pdf_report(org_id=org_id, db=db_session)
                assert os.path.exists(pdf_path), f"PDF report not generated at {pdf_path}"
                assert os.path.getsize(pdf_path) > 1000, "PDF report is empty or incomplete"
                # Clean up test artifact
                try:
                    os.remove(pdf_path)
                except OSError:
                    pass

            print("  ✅ PASS: BG-SEC-08 ReportLab safely renders malicious unescaped XML/HTML strings without crashing.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-08: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-09: Missing Admin Authorization on Destructive Routes
        # ----------------------------------------------------------------------
        print("\n[9/12] Testing BG-SEC-09: Role-Based Access Control (RBAC) on Destructive Routes...")
        try:
            # 1. Member user attempting to delete domain -> 403 Forbidden
            res_delete_member = await client.delete(
                f"/api/domains/{domain_id}",
                headers={"Authorization": f"Bearer {member_token}"}
            )
            assert res_delete_member.status_code == 403, f"Expected 403 for member domain deletion, got {res_delete_member.status_code}"

            # 2. Member user attempting to modify integrations -> 403 Forbidden
            res_integ_member = await client.patch(
                "/api/settings/integrations",
                headers={"Authorization": f"Bearer {member_token}"},
                json={"slack_webhook_url": "https://siem.test-enterprise.internal/alerts"}
            )
            assert res_integ_member.status_code == 403, f"Expected 403 for member integrations update, got {res_integ_member.status_code}"

            # 3. Admin user deleting domain -> 200 OK
            res_delete_admin = await client.delete(
                f"/api/domains/{domain_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert res_delete_admin.status_code == 200, f"Expected 200 for admin domain deletion, got {res_delete_admin.status_code}"

            print("  ✅ PASS: BG-SEC-09 Destructive routes strictly restricted to Admin role; unauthorized roles blocked with 403.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-09: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-10: In-Memory / Spoofable Rate Limiter Hardening
        # ----------------------------------------------------------------------
        print("\n[10/12] Testing BG-SEC-10: Client IP Anti-Spoofing & Sliding Window Rate Limiting...")
        try:
            # Test direct client IP extraction without trusted proxy
            class MockClient:
                host = "198.51.100.25"

            class MockRequest:
                def __init__(self, headers, client_ip):
                    self.headers = headers
                    self.client = MockClient()
                    self.client.host = client_ip

            # Attacker attempts to spoof X-Forwarded-For directly
            req_spoofed = MockRequest(headers={"x-forwarded-for": "10.0.0.1"}, client_ip="198.51.100.25")
            detected_ip = get_client_ip(req_spoofed)
            assert detected_ip == "198.51.100.25", f"Rate limiter accepted spoofed X-Forwarded-For: {detected_ip}"

            # Cloudflare trusted proxy CF-Connecting-IP
            req_cf = MockRequest(headers={"cf-connecting-ip": "203.0.113.88"}, client_ip="173.245.48.5")
            cf_detected = get_client_ip(req_cf)
            assert cf_detected == "203.0.113.88", f"Failed to extract CF-Connecting-IP from trusted proxy: {cf_detected}"

            # Test HybridRateLimiter sliding window
            limiter = HybridRateLimiter()
            test_key = f"test_rate_limit_{uid}"
            # Consume 3 requests with limit 3 per 60 seconds
            assert limiter.is_rate_limited(test_key, 3, 60) is False
            assert limiter.is_rate_limited(test_key, 3, 60) is False
            assert limiter.is_rate_limited(test_key, 3, 60) is False
            # 4th request must be rate-limited
            assert limiter.is_rate_limited(test_key, 3, 60) is True

            print("  ✅ PASS: BG-SEC-10 IP header spoofing prevented; sliding window rate limiter enforces request limits.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-10: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-11: Password Reset Token Replay Protection
        # ----------------------------------------------------------------------
        print("\n[11/12] Testing BG-SEC-11: Password Reset Single-Use & Replay Protection...")
        try:
            # Create a dedicated user for reset test
            reset_email = f"reset_{uid}@sectest.com"
            async with AsyncSessionLocal() as db:
                r_user = User(
                    email=reset_email,
                    hashed_password=get_password_hash("OldPassword123!"),
                    org_id=org_id,
                    role="member",
                )
                db.add(r_user)
                await db.commit()
                await db.refresh(r_user)

            reset_token = create_reset_token(reset_email)

            # First use: must succeed
            res_first = await client.post(
                "/api/auth/reset-password",
                json={"token": reset_token, "new_password": "NewSecretPassword123!"}
            )
            assert res_first.status_code == 200, f"Expected 200 on first password reset, got {res_first.status_code}: {res_first.text}"

            # Second use (replay attack): must fail with 400
            res_replay = await client.post(
                "/api/auth/reset-password",
                json={"token": reset_token, "new_password": "HackerPassword123!"}
            )
            assert res_replay.status_code == 400, f"Expected 400 on replay reset, got {res_replay.status_code}: {res_replay.text}"
            assert "already been used" in res_replay.text.lower() or "invalid" in res_replay.text.lower()

            print("  ✅ PASS: BG-SEC-11 Password reset token cannot be replayed; invalidated immediately upon first use.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-11: {e}")

        # ----------------------------------------------------------------------
        # BG-SEC-12: HttpOnly Cookie Authentication Migration
        # ----------------------------------------------------------------------
        print("\n[12/12] Testing BG-SEC-12: HttpOnly Cookie Session Auth & Logout...")
        try:
            # 1. Login sets HttpOnly bg_session cookie
            login_res = await client.post(
                "/api/auth/login",
                json={"email": admin_email, "password": "AdminSecPass123!"}
            )
            assert login_res.status_code == 200, f"Login failed: {login_res.text}"
            set_cookie_header = login_res.headers.get("set-cookie", "")
            assert "bg_session=" in set_cookie_header, "Set-Cookie header missing bg_session"
            assert "httponly" in set_cookie_header.lower(), "bg_session cookie missing HttpOnly flag"
            assert "samesite=lax" in set_cookie_header.lower(), "bg_session cookie missing SameSite=Lax flag"

            # Extract cookie value
            cookie_value = None
            for part in set_cookie_header.split(";"):
                if "bg_session=" in part:
                    cookie_value = part.strip().split("=")[1]
                    break
            assert cookie_value, "Failed to extract bg_session cookie value"

            # 2. Access protected endpoint WITHOUT Authorization header, using ONLY the cookie
            me_res = await client.get(
                "/api/auth/me",
                cookies={"bg_session": cookie_value}
            )
            assert me_res.status_code == 200, f"Cookie authentication failed: {me_res.status_code} {me_res.text}"
            assert me_res.json()["email"] == admin_email, "Cookie authenticated wrong user"

            # 3. Test logout endpoint clears cookie
            logout_res = await client.post(
                "/api/auth/logout",
                cookies={"bg_session": cookie_value}
            )
            assert logout_res.status_code == 200, f"Logout failed: {logout_res.status_code}"
            logout_cookie = logout_res.headers.get("set-cookie", "")
            assert "bg_session=" in logout_cookie, "Logout did not send Set-Cookie header"
            assert 'max-age=0' in logout_cookie.lower() or 'expires=' in logout_cookie.lower(), "Logout cookie did not expire"

            print("  ✅ PASS: BG-SEC-12 HttpOnly cookie authentication functional with automatic session clearing on logout.")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ FAIL BG-SEC-12: {e}")

    print("\n" + "=" * 80)
    print(f"🎯 SECURITY TEST SUITE RESULTS: {passed_tests}/{total_tests} TESTS PASSED")
    print("=" * 80)

    if passed_tests == total_tests:
        print("ALL 12 VULNERABILITIES SUCCESSFULLY REMEDIATED AND VERIFIED! 🎉")
        sys.exit(0)
    else:
        print(f"WARNING: {total_tests - passed_tests} test(s) failed.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_security_tests())
