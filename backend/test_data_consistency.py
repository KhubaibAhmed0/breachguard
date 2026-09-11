import asyncio
import sys
import uuid
import httpx

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from main import app, init_models
from core.database import AsyncSessionLocal
from sqlalchemy.future import select
from models.organization import Organization
from models.user import User
from models.domain import MonitoredDomain
from models.asset import DiscoveredAsset, EmailSecurityAssessment, RiskAssessment
from models.finding import Finding
from core.security import get_password_hash, create_access_token

async def run_consistency_tests():
    print("==================================================")
    print("🧪 BREACHGUARD DATA CONSISTENCY & SCORING AUDIT")
    print("==================================================")

    await init_models()

    uid = uuid.uuid4().hex[:6]
    test_email = f"audit_{uid}@testcorp.com"

    # 1. Create a clean isolated test organization
    async with AsyncSessionLocal() as session:
        test_org = Organization(name=f"Consistency Test Org {uid}", plan="business")
        session.add(test_org)
        await session.commit()
        await session.refresh(test_org)

        test_user = User(
            email=test_email,
            hashed_password=get_password_hash("TestPass123!"),
            role="admin",
            org_id=test_org.id
        )
        session.add(test_user)
        await session.commit()
        await session.refresh(test_user)
        test_user_id = test_user.id
        test_org_id = test_org.id

    token = create_access_token(subject=test_user_id)
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        try:
            # ----------------------------------------------------
            # TEST 1: ZERO-DOMAIN STATE PURITY
            # ----------------------------------------------------
            print("\n--- TEST 1: Zero-Domain State Verification ---")
            res = await client.get("/api/risk/overview", headers=headers)
            assert res.status_code == 200, f"Failed: {res.text}"
            data = res.json()
            print(f"Risk Overview (0 domains): {data}")
            assert data["overall_risk_score"] == 0, f"Expected 0, got {data['overall_risk_score']}"
            assert data["risk_level"] == "NOT ASSESSED", f"Expected NOT ASSESSED, got {data['risk_level']}"
            assert data["summary"]["discovered_assets"] == 0
            assert data["summary"]["open_findings"] == 0
            assert data["summary"]["monitored_domains"] == 0
            assert data["categories"]["attack_surface"] == 0
            assert data["categories"]["email_security"] == 0
            assert data["categories"]["threat_intelligence"] == 0
            assert data["categories"]["credential_exposure"] == 0
            print("✅ Zero-domain state is strictly 0 across all categories, assets, and findings.")

            # Timeline test
            res_tl = await client.get("/api/exposures/timeline", headers=headers)
            assert res_tl.status_code == 200
            tl_data = res_tl.json()
            print(f"Timeline: {tl_data}")
            assert sum(tl_data["data"]) == 0
            print("✅ Exposure timeline strictly 0 when no exposures exist.")

            # ----------------------------------------------------
            # TEST 2: DOMAIN CREATION, SCAN & MATHEMATICAL SCORING
            # ----------------------------------------------------
            print("\n--- TEST 2: Domain Creation, Scan & Scoring Breakdown ---")
            domain_name = f"verify-{uid}.org"
            res_add = await client.post("/api/domains", json={"domain": domain_name, "scan_frequency": "daily"}, headers=headers)
            assert res_add.status_code == 200, f"Failed: {res_add.text}"
            domain_id = res_add.json()["id"]
            print(f"Created Domain: id={domain_id}, name={domain_name}")

            # Trigger passive scan
            res_scan = await client.post(f"/api/domains/{domain_id}/scan", headers=headers)
            assert res_scan.status_code == 200
            print(f"Scan Triggered: {res_scan.json()}")

            # Check risk overview now
            res_risk = await client.get("/api/risk/overview", headers=headers)
            assert res_risk.status_code == 200
            risk_data = res_risk.json()
            print(f"Post-scan Risk Overview:")
            print(f"  Overall Risk Score: {risk_data['overall_risk_score']}/100 ({risk_data['risk_level']})")
            print(f"  Categories: {risk_data['categories']}")
            print(f"  Summary: {risk_data['summary']}")
            print(f"  Formula: {risk_data['scoring_breakdown']['formula']}")
            print(f"  Weighted Posture: {risk_data['scoring_breakdown']['weighted_posture_score']}")

            # Validate mathematical consistency
            as_s = risk_data["categories"]["attack_surface"]
            eml_s = risk_data["categories"]["email_security"]
            ti_s = risk_data["categories"]["threat_intelligence"]
            cred_s = risk_data["categories"]["credential_exposure"]

            expected_posture = (as_s * 0.30) + (eml_s * 0.25) + (ti_s * 0.20) + (cred_s * 0.25)
            expected_risk = max(0, min(100, int(round(100.0 - expected_posture))))

            assert risk_data["overall_risk_score"] == expected_risk, \
                f"Mathematical mismatch! Expected {expected_risk}, got {risk_data['overall_risk_score']}"
            print(f"✅ Mathematical derivation strictly verified: 100 - ({expected_posture:.1f}) = {expected_risk}")

            # Check scoring breakdown items
            breakdown = risk_data["scoring_breakdown"]
            assert "pillars" in breakdown
            assert "attack_surface" in breakdown["pillars"]
            assert "email_security" in breakdown["pillars"]
            assert "threat_intelligence" in breakdown["pillars"]
            assert "credential_exposure" in breakdown["pillars"]
            print("✅ Scoring breakdown contains all 4 pillar deduction trees and methodologies.")

            # ----------------------------------------------------
            # TEST 3: CASCADE DELETION INTEGRITY
            # ----------------------------------------------------
            print("\n--- TEST 3: Cascade Deletion Integrity ---")
            res_del = await client.delete(f"/api/domains/{domain_id}", headers=headers)
            assert res_del.status_code == 200
            print(f"Deleted Domain: {res_del.json()}")

            # Verify DB directly: assets, findings, assessments must be 0
            async with AsyncSessionLocal() as session:
                assets_left = (await session.execute(select(DiscoveredAsset).where(DiscoveredAsset.domain_id == domain_id))).scalars().all()
                findings_left = (await session.execute(select(Finding).where(Finding.domain_id == domain_id))).scalars().all()
                ra_left = (await session.execute(select(RiskAssessment).where(RiskAssessment.domain_id == domain_id))).scalars().all()
                eml_left = (await session.execute(select(EmailSecurityAssessment).where(EmailSecurityAssessment.domain_id == domain_id))).scalars().all()

                assert len(assets_left) == 0, f"Cascade failed! DiscoveredAssets left: {len(assets_left)}"
                assert len(findings_left) == 0, f"Cascade failed! Findings left: {len(findings_left)}"
                assert len(ra_left) == 0, f"Cascade failed! RiskAssessments left: {len(ra_left)}"
                assert len(eml_left) == 0, f"Cascade failed! EmailSecurityAssessments left: {len(eml_left)}"
                print("✅ Direct DB query confirms 0 orphaned assets, findings, or assessments.")

            # Re-query /api/risk/overview
            res_final = await client.get("/api/risk/overview", headers=headers)
            assert res_final.status_code == 200
            final_data = res_final.json()
            assert final_data["overall_risk_score"] == 0
            assert final_data["summary"]["discovered_assets"] == 0
            assert final_data["summary"]["open_findings"] == 0
            assert final_data["risk_level"] == "NOT ASSESSED"
            print("✅ Dashboard API strictly returns to zero-state post deletion.")

            print("\n🎉 ALL CONSISTENCY & INTEGRITY TESTS PASSED PERFECTLY!")

        finally:
            # Cleanup test org and user
            async with AsyncSessionLocal() as session:
                u = await session.get(User, test_user_id)
                if u:
                    await session.delete(u)
                o = await session.get(Organization, test_org_id)
                if o:
                    await session.delete(o)
                await session.commit()
            print("🧹 Cleaned up temporary test organization and user.")

if __name__ == "__main__":
    asyncio.run(run_consistency_tests())
