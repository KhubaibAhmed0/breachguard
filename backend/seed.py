import asyncio
from datetime import datetime, timedelta
from core.database import engine, Base, AsyncSessionLocal
from models.organization import Organization
from models.user import User
from models.domain import MonitoredDomain, MonitoredEmail
from models.exposure import Exposure
from models.scan_job import ScanJob
from models.report import Report
from core.security import get_password_hash

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy.future import select
        existing_org = await session.execute(select(Organization).limit(1))
        if existing_org.scalars().first():
            print("Database already contains records. Skipping seed.")
            return

        # 1. Organization
        org = Organization(name="Acme CyberCorp", plan="professional")
        session.add(org)
        await session.commit()
        await session.refresh(org)
        
        # 2. Users
        user = User(
            email="admin@acme.com",
            hashed_password=get_password_hash("password123"),
            org_id=org.id,
            role="admin"
        )
        session.add(user)
        await session.commit()

        # 3. Monitored Domains
        domain1 = MonitoredDomain(org_id=org.id, domain="acme.com", verified=True, scan_frequency="daily", last_scanned_at=datetime.utcnow() - timedelta(hours=2))
        domain2 = MonitoredDomain(org_id=org.id, domain="dev.acme.com", verified=True, scan_frequency="daily", last_scanned_at=datetime.utcnow() - timedelta(hours=8))
        domain3 = MonitoredDomain(org_id=org.id, domain="staging-acme.net", verified=False, scan_frequency="weekly")
        session.add_all([domain1, domain2, domain3])
        await session.commit()
        await session.refresh(domain1)
        await session.refresh(domain2)

        # 4. Monitored Emails
        e1 = MonitoredEmail(domain_id=domain1.id, email="ceo@acme.com", is_vip=True)
        e2 = MonitoredEmail(domain_id=domain1.id, email="cfo@acme.com", is_vip=True)
        e3 = MonitoredEmail(domain_id=domain1.id, email="admin@acme.com", is_vip=False)
        e4 = MonitoredEmail(domain_id=domain2.id, email="dev@dev.acme.com", is_vip=False)
        e5 = MonitoredEmail(domain_id=domain1.id, email="sales@acme.com", is_vip=False)
        session.add_all([e1, e2, e3, e4, e5])
        await session.commit()
        await session.refresh(e1)
        await session.refresh(e2)
        await session.refresh(e3)
        await session.refresh(e4)
        await session.refresh(e5)

        # 5. Exposures
        exposures = [
            Exposure(
                email_id=e1.id, org_id=org.id, source_name="LinkedIn 2021 Breach", source_type="breach",
                data_classes=["email", "passwords", "job titles"], severity="critical", credential_type="plaintext",
                first_seen_at=datetime.utcnow() - timedelta(days=90), status="open"
            ),
            Exposure(
                email_id=e2.id, org_id=org.id, source_name="Stealer Log RedLine v4", source_type="stealer_log",
                data_classes=["email", "passwords", "browser cookies", "system info"], severity="critical", credential_type="plaintext",
                first_seen_at=datetime.utcnow() - timedelta(days=14), status="open"
            ),
            Exposure(
                email_id=e3.id, org_id=org.id, source_name="Canva Database Dump", source_type="breach",
                data_classes=["email", "password hashes", "names"], severity="high", credential_type="hashed",
                first_seen_at=datetime.utcnow() - timedelta(days=45), status="open"
            ),
            Exposure(
                email_id=e4.id, org_id=org.id, source_name="GitHub Public Secret Leak", source_type="paste",
                data_classes=["email", "aws api keys", "tokens"], severity="critical", credential_type="api_token",
                first_seen_at=datetime.utcnow() - timedelta(days=5), status="open"
            ),
            Exposure(
                email_id=e5.id, org_id=org.id, source_name="Apollo Marketing Directory", source_type="breach",
                data_classes=["email", "phone numbers", "company names"], severity="low", credential_type="none",
                first_seen_at=datetime.utcnow() - timedelta(days=200), status="remediated"
            ),
            Exposure(
                email_id=e3.id, org_id=org.id, source_name="Adobe Creative Cloud Leak", source_type="breach",
                data_classes=["email", "password hints"], severity="medium", credential_type="hint",
                first_seen_at=datetime.utcnow() - timedelta(days=300), status="acknowledged"
            ),
        ]
        session.add_all(exposures)

        # 6. Scan Jobs
        job = ScanJob(domain_id=domain1.id, status="completed", sources_queried=["hibp", "leakcheck"], new_exposures_found=4, started_at=datetime.utcnow() - timedelta(hours=3), completed_at=datetime.utcnow() - timedelta(hours=2))
        session.add(job)

        # 7. Sample Report
        rep = Report(org_id=org.id, report_type="Executive", file_url="reports/sample_executive_report.html")
        session.add(rep)

        await session.commit()
        print("Seed completed successfully! Admin: admin@acme.com / password123")

if __name__ == "__main__":
    asyncio.run(seed())
