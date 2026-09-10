from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class DiscoveredAsset(Base):
    __tablename__ = 'discovered_assets'
    
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey('organizations.id'), index=True, nullable=False)
    domain_id = Column(Integer, ForeignKey('monitored_domains.id'), index=True, nullable=False)
    
    hostname = Column(String, index=True, nullable=False)
    ip_address = Column(String, index=True, nullable=True)
    asn = Column(String, nullable=True)
    organization_name = Column(String, nullable=True)
    
    open_ports = Column(Text, nullable=True)  # JSON array of port numbers
    services = Column(Text, nullable=True)    # JSON map of port -> service
    technologies = Column(Text, nullable=True) # JSON array of detected software/CPEs
    vulns = Column(Text, nullable=True)       # JSON array of CVEs from passive feeds
    
    source = Column(String, default='crt.sh / Shodan InternetDB')
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    
    organization = relationship('Organization', backref='discovered_assets')
    domain = relationship('MonitoredDomain', backref='discovered_assets')

class EmailSecurityAssessment(Base):
    __tablename__ = 'email_security_assessments'
    
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey('organizations.id'), index=True, nullable=False)
    domain_id = Column(Integer, ForeignKey('monitored_domains.id'), index=True, nullable=False)
    domain = Column(String, nullable=False)
    
    spf_status = Column(String, default='fail')  # pass, warning, fail
    spf_record = Column(Text, nullable=True)
    spf_details = Column(Text, nullable=True)
    
    dmarc_status = Column(String, default='fail')  # pass, warning, fail
    dmarc_record = Column(Text, nullable=True)
    dmarc_policy = Column(String, nullable=True)  # reject, quarantine, none, missing
    dmarc_details = Column(Text, nullable=True)
    
    dkim_status = Column(String, default='not_verifiable')  # pass, warning, not_verifiable
    dkim_details = Column(Text, nullable=True)
    
    mx_status = Column(String, default='fail')  # pass, warning, fail
    mx_records = Column(Text, nullable=True)
    
    mta_sts_status = Column(String, default='not_detected')  # pass, not_detected
    tls_rpt_status = Column(String, default='not_detected')  # pass, not_detected
    dnssec_status = Column(String, default='not_detected')   # pass, not_detected
    
    score = Column(Integer, default=0)  # 0-100
    created_at = Column(DateTime, default=datetime.utcnow)
    
    organization = relationship('Organization', backref='email_assessments')
    domain_rel = relationship('MonitoredDomain', backref='email_assessments')

class RiskAssessment(Base):
    __tablename__ = 'risk_assessments'
    
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey('organizations.id'), index=True, nullable=False)
    domain_id = Column(Integer, ForeignKey('monitored_domains.id'), index=True, nullable=False)
    
    attack_surface_score = Column(Integer, default=100)
    email_security_score = Column(Integer, default=100)
    threat_intel_score = Column(Integer, default=100)
    credential_score = Column(Integer, default=100)
    overall_score = Column(Integer, default=100)
    risk_level = Column(String, default='low')  # low, medium, high, critical
    
    findings_count = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    organization = relationship('Organization', backref='risk_assessments')
    domain = relationship('MonitoredDomain', backref='risk_assessments')
