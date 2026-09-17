import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.database import AsyncSessionLocal, engine, Base
from services.client_hunter_service import run_autonomous_client_hunt, INDUSTRY_CONFIGS

async def main():
    print(">>> Testing Client Hunter Service...")
    
    # 1. Verify industry configurations
    assert "law_firms" in INDUSTRY_CONFIGS
    assert "cpa_firms" in INDUSTRY_CONFIGS
    assert "regional_msps" in INDUSTRY_CONFIGS
    print(f"Verified {len(INDUSTRY_CONFIGS)} target industry configurations.")

    # 2. Run test hunt for Law Firms (batch of 2 real law firms)
    async with AsyncSessionLocal() as db:
        print("\n>>> Running Autonomous Client Hunt (Industry: Law Firms, Batch: 2)...")
        res = await run_autonomous_client_hunt(
            db=db,
            industry="law_firms",
            batch_size=2,
            provider="real_directory"
        )
        print(f"Status: {res['status']}")
        print(f"Message: {res['message']}")
        print(f"Leads Created/Qualified: {res['leads_created']}")

        for lead in res.get("qualified_leads", []):
            print(f"\n- Target: {lead['company_name']} ({lead['domain']})")
            print(f"  Contact: {lead['contact_name']} <{lead['contact_email']}>")
            print(f"  DMARC Status: {lead['dmarc_status']}")
            print(f"  Perimeter Risk Score: {lead['risk_score']}/100 ({lead['risk_level']})")
            print(f"  Subject: {lead['email_subject']}")
            print(f"  PDF Generated: {lead['pdf_ready']}")
            assert lead['domain'] is not None
            assert lead['email_subject'] is not None
            assert lead['pdf_ready'] is True

    print("\n>>> ALL CLIENT HUNTER TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
