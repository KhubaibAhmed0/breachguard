from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from datetime import datetime
from core.database import Base

class OutreachLead(Base):
    """
    Represents a prospective client company targeted for automated cold outreach.
    Stores passive perimeter scan telemetry, customized email drafts, and delivery state.
    """
    __tablename__ = "outreach_leads"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False, index=True)
    domain = Column(String, nullable=False, index=True)
    contact_email = Column(String, nullable=False, index=True)
    contact_name = Column(String, nullable=True)

    # Lead & Reconnaissance State: pending_scan, scanned, ready, sent, failed
    status = Column(String, default="pending_scan", index=True)
    
    # Passive Perimeter Telemetry
    risk_score = Column(Integer, nullable=True)
    risk_level = Column(String, nullable=True)
    dmarc_status = Column(String, nullable=True)  # missing, p=none, p=quarantine, p=reject
    dmarc_record = Column(String, nullable=True)
    exposed_ports = Column(Text, nullable=True)   # JSON string of open admin ports, e.g. ["22 (SSH)", "3389 (RDP)"]
    subdomains_count = Column(Integer, default=0)
    breach_count = Column(Integer, default=0)
    breach_sources = Column(Text, nullable=True)  # JSON string of breach names
    top_findings = Column(Text, nullable=True)    # JSON string of summarized bullets

    # Email Draft & Customization
    email_angle = Column(String, default="dmarc_spoofing")  # dmarc_spoofing, open_ports, executive_summary
    email_subject = Column(String, nullable=True)
    email_body = Column(Text, nullable=True)

    # Delivery Audit
    sent_at = Column(DateTime, nullable=True)
    delivery_status = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SocialPost(Base):
    """
    Stores scheduled and published social media posts for Twitter/X and Reddit.
    Automates an ongoing 3-day cadence driving traffic to BreachGuard's free scanner.
    """
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, nullable=False, index=True)  # twitter, reddit, both
    category = Column(String, nullable=False, index=True)  # attack_surface, email_security, threat_intel, msp_growth
    
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    hook = Column(String, nullable=True)
    call_to_action = Column(String, nullable=True)
    target_subreddit = Column(String, nullable=True)       # e.g., r/msp, r/cybersecurity, r/sysadmin
    
    # Cadence & Scheduling
    scheduled_for = Column(DateTime, nullable=True, index=True)
    cadence_day = Column(Integer, default=1)               # Day offset (1, 4, 7, 10, 13, 16...)
    status = Column(String, default="scheduled", index=True)  # scheduled, ready, published
    published_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
