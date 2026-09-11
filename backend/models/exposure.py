from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from core.database import Base

class Exposure(Base):
    __tablename__ = "exposures"
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("monitored_emails.id"), index=True, nullable=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    source_name = Column(String, index=True, nullable=False)
    source_type = Column(String, nullable=False) # breach/stealer_log/paste
    data_classes = Column(JSON, default=list)
    severity = Column(String, index=True, nullable=False) # critical/high/medium/low
    credential_type = Column(String, nullable=True)
    first_seen_at = Column(DateTime, nullable=True)
    detected_at = Column(DateTime, index=True, default=datetime.utcnow)
    status = Column(String, index=True, default="open") # open/acknowledged/remediated
    raw_data = Column(JSON, nullable=True) # Using JSON for general compatibility if JSONB unavailable
    created_at = Column(DateTime, default=datetime.utcnow)

    email_rel = relationship("MonitoredEmail", back_populates="exposures")
    organization = relationship("Organization", back_populates="exposures")
    alerts = relationship("Alert", back_populates="exposure")
