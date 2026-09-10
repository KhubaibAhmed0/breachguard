from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    plan = Column(String, default="essential")
    is_msp = Column(Boolean, default=False)
    parent_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    logo_path = Column(String, nullable=True)
    slack_webhook_url = Column(String, nullable=True)
    siem_webhook_url = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    is_trial = Column(Boolean, default=False)
    trial_ends_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="organization")
    domains = relationship("MonitoredDomain", back_populates="organization")
    exposures = relationship("Exposure", back_populates="organization")

    # Multi-tenant MSP parent / child tenant relationships
    children = relationship("Organization", back_populates="parent", foreign_keys=[parent_org_id])
    parent = relationship("Organization", back_populates="children", remote_side=[id], foreign_keys=[parent_org_id])
