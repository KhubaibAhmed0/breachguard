from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Finding(Base):
    __tablename__ = 'findings'
    
    id = Column(Integer, primary_key=True, index=True)
    finding_id = Column(String, index=True, nullable=False)  # e.g. BG-EXT-001
    org_id = Column(Integer, ForeignKey('organizations.id'), index=True, nullable=False)
    domain_id = Column(Integer, ForeignKey('monitored_domains.id'), index=True, nullable=False)
    
    category = Column(String, index=True, nullable=False)  # attack_surface, email_security, threat_intel, credential_exposure
    title = Column(String, nullable=False)
    severity = Column(String, index=True, nullable=False)  # critical, high, medium, low, info
    status = Column(String, index=True, default='open')  # open, acknowledged, in_progress, remediated, accepted_risk, false_positive
    observed_status = Column(String, default='detected')  # detected, no_longer_detected
    confidence = Column(String, default='high')  # high, medium, low
    
    asset = Column(String, nullable=False)  # e.g. vpn.example.com or _dmarc.example.com
    evidence = Column(Text, nullable=True)  # Technical details / records observed
    sources = Column(Text, nullable=True)  # JSON or comma-separated list of providers
    
    description = Column(Text, nullable=True)
    security_impact = Column(Text, nullable=True)
    recommended_remediation = Column(Text, nullable=True)
    references = Column(String, nullable=True)  # Framework mappings: NIST CSF, CIS, RFCs
    
    first_observed_at = Column(DateTime, default=datetime.utcnow)
    last_observed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship('Organization', backref='findings')
    domain = relationship('MonitoredDomain', backref='findings')
