from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class ScanJob(Base):
    __tablename__ = "scan_jobs"
    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("monitored_domains.id"))
    status = Column(String, default="pending")
    sources_queried = Column(JSON, default=list)
    new_exposures_found = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    domain = relationship("MonitoredDomain", back_populates="scan_jobs")
