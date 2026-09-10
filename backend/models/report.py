from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from core.database import Base

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    report_type = Column(String, nullable=False)
    domain_name = Column(String, nullable=True)
    file_url = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
