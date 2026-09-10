from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import json

from core.database import get_db
from models.user import User
from models.domain import MonitoredDomain
from models.asset import DiscoveredAsset
from models.finding import Finding
from routers.deps import get_current_user

router = APIRouter(prefix="/api/attack-surface", tags=["attack-surface"])

@router.get("/assets")
async def get_discovered_assets(
    domain_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(DiscoveredAsset).where(DiscoveredAsset.org_id == current_user.org_id)
    if domain_id:
        query = query.where(DiscoveredAsset.domain_id == domain_id)
    
    res = await db.execute(query.order_by(DiscoveredAsset.hostname))
    assets = res.scalars().all()
    
    out = []
    for a in assets:
        ports = []
        services = {}
        vulns = []
        try:
            if a.open_ports:
                ports = json.loads(a.open_ports)
            if a.services:
                services = json.loads(a.services)
            if a.vulns:
                vulns = json.loads(a.vulns)
        except Exception:
            pass

        out.append({
            "id": a.id,
            "domain_id": a.domain_id,
            "hostname": a.hostname,
            "ip_address": a.ip_address,
            "asn": a.asn,
            "organization_name": a.organization_name,
            "open_ports": ports,
            "services": services,
            "vulns": vulns,
            "source": a.source,
            "first_seen_at": a.first_seen_at.isoformat() if a.first_seen_at else None,
            "last_seen_at": a.last_seen_at.isoformat() if a.last_seen_at else None
        })
    return out

@router.get("/findings")
async def get_attack_surface_findings(
    domain_id: Optional[int] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Finding).where(
        Finding.org_id == current_user.org_id,
        Finding.category == "attack_surface"
    )
    if domain_id:
        query = query.where(Finding.domain_id == domain_id)
    if severity:
        query = query.where(Finding.severity == severity)
    if status:
        query = query.where(Finding.status == status)

    res = await db.execute(query.order_by(Finding.id.desc()))
    findings = res.scalars().all()
    
    out = []
    for f in findings:
        sources_list = []
        try:
            if f.sources:
                sources_list = json.loads(f.sources)
        except Exception:
            sources_list = [f.sources] if f.sources else []

        out.append({
            "id": f.id,
            "finding_id": f.finding_id,
            "title": f.title,
            "severity": f.severity,
            "status": f.status,
            "observed_status": f.observed_status,
            "confidence": f.confidence,
            "asset": f.asset,
            "evidence": f.evidence,
            "sources": sources_list,
            "description": f.description,
            "security_impact": f.security_impact,
            "recommended_remediation": f.recommended_remediation,
            "references": f.references,
            "first_observed_at": f.first_observed_at.isoformat() if f.first_observed_at else None,
            "last_observed_at": f.last_observed_at.isoformat() if f.last_observed_at else None
        })
    return out
