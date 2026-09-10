from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class MonitoredDomain(Base):
    __tablename__ = "monitored_domains"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    domain = Column(String, index=True, nullable=False)
    verified = Column(Boolean, default=False)
    scan_frequency = Column(String, default="daily")
    last_scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="domains")
    emails = relationship("MonitoredEmail", back_populates="domain")
    scan_jobs = relationship("ScanJob", back_populates="domain")

class MonitoredEmail(Base):
    __tablename__ = "monitored_emails"
    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("monitored_domains.id"))
    email = Column(String, index=True, nullable=False)
    is_vip = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    domain = relationship("MonitoredDomain", back_populates="emails")
    exposures = relationship("Exposure", back_populates="email_rel")
