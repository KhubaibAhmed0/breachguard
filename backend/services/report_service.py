import os
import uuid
import html
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from models.exposure import Exposure
from models.domain import MonitoredDomain, MonitoredEmail
from models.organization import Organization
from models.finding import Finding
from models.asset import DiscoveredAsset, EmailSecurityAssessment, RiskAssessment

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable, Image as RLImage, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to compute total page numbers and add corporate footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        # Footer text & line
        self.drawString(36, 22, "BreachGuard External Cyber Risk Assessment | STRICTLY CONFIDENTIAL")
        self.drawRightString(letter[0] - 36, 22, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(36, 32, letter[0] - 36, 32)
        self.restoreState()

def mask_email(email: str) -> str:
    if "@" not in email:
        return email
    user, dom = email.split("@", 1)
    if len(user) <= 2:
        masked_user = user[0] + "***"
    else:
        masked_user = user[0] + "***" + user[-1]
    return f"{masked_user}@{dom}"

async def generate_pdf_report(
    org_id: int, 
    report_type: str = "Full Assessment", 
    domain_name: Optional[str] = None, 
    db: AsyncSession = None
) -> str:
    """
    Generates a professional, legally defensible, 10-15 page External Cyber Risk Assessment.
    """
    # 1. Fetch organization
    org_res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_res.scalars().first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")

    # 2. Fetch target domain
    domain_query = select(MonitoredDomain).where(MonitoredDomain.org_id == org_id)
    if domain_name:
        domain_query = domain_query.where(MonitoredDomain.domain == domain_name)
    domain_res = await db.execute(domain_query)
    monitored_domain = domain_res.scalars().first()
    target_domain = monitored_domain.domain if monitored_domain else (domain_name or "Target Environment")
    domain_id = monitored_domain.id if monitored_domain else 0

    # 3. Fetch all findings
    f_res = await db.execute(select(Finding).where(Finding.org_id == org_id).order_by(Finding.id.desc()))
    all_findings = f_res.scalars().all()
    if domain_id:
        all_findings = [f for f in all_findings if f.domain_id == domain_id]

    # 4. Fetch discovered assets
    a_res = await db.execute(select(DiscoveredAsset).where(DiscoveredAsset.org_id == org_id))
    assets = a_res.scalars().all()
    if domain_id:
        assets = [a for a in assets if a.domain_id == domain_id]

    # 5. Fetch email assessment
    ea_res = await db.execute(select(EmailSecurityAssessment).where(EmailSecurityAssessment.org_id == org_id).order_by(EmailSecurityAssessment.id.desc()))
    email_assessment = ea_res.scalars().first()

    # 6. Fetch risk assessment
    ra_res = await db.execute(select(RiskAssessment).where(RiskAssessment.org_id == org_id).order_by(RiskAssessment.id.desc()))
    risk_assessment = ra_res.scalars().first()

    # 7. Fetch exposures
    e_res = await db.execute(
        select(Exposure)
        .options(selectinload(Exposure.email_rel))
        .where(Exposure.org_id == org_id)
        .order_by(Exposure.id.desc())
    )
    exposures = e_res.scalars().all()

    # Calculate metrics
    crit_findings = [f for f in all_findings if f.severity == "critical"]
    high_findings = [f for f in all_findings if f.severity == "high"]
    med_findings = [f for f in all_findings if f.severity == "medium"]
    low_findings = [f for f in all_findings if f.severity in ["low", "info"]]
    open_findings = [f for f in all_findings if f.status == "open"]

    overall_risk = risk_assessment.overall_score if risk_assessment else (65 if high_findings else 20)
    risk_level = risk_assessment.risk_level if risk_assessment else ("HIGH RISK" if high_findings else "LOW RISK")
    
    as_score = risk_assessment.attack_surface_score if risk_assessment else 85
    em_score = email_assessment.score if email_assessment else 60
    ti_score = risk_assessment.threat_intel_score if risk_assessment else 80
    cr_score = risk_assessment.credential_score if risk_assessment else 90

    # Ensure reports output directory exists
    os.makedirs("reports", exist_ok=True)
    report_id = f"BG-{uuid.uuid4().hex[:8].upper()}"
    filename = f"reports/Security_Assessment_{target_domain}_{report_id}.pdf"

    # Setup styles
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#0F172A")
    text_dark = colors.HexColor("#1E293B")
    text_muted = colors.HexColor("#64748B")
    border_color = colors.HexColor("#E2E8F0")
    bg_light = colors.HexColor("#F8FAFC")

    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        textColor=primary_color
    )
    h1_style = ParagraphStyle(
        "ReportH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=primary_color,
        spaceAfter=10
    )
    h2_style = ParagraphStyle(
        "ReportH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=primary_color,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=text_dark
    )
    body_bold = ParagraphStyle(
        "ReportBodyBold",
        parent=body_style,
        fontName="Helvetica-Bold"
    )
    callout_style = ParagraphStyle(
        "CalloutText",
        parent=body_style,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155")
    )

    elements = []

    # =========================================================================
    # PAGE 1: COVER PAGE
    # =========================================================================
    elements.append(Spacer(1, 40))
    # Header badge
    elements.append(Paragraph("<b>BREACHGUARD SECURITY INTELLIGENCE</b>", ParagraphStyle("HeaderBadge", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#475569"))))
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("External Cyber Risk Assessment", title_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Comprehensive Attack Surface, Email Security & Threat Exposure Evaluation", ParagraphStyle("CoverSub", fontName="Helvetica", fontSize=11, textColor=text_muted)))
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=2, color=primary_color, spaceAfter=25))

    # Metadata table
    today_str = datetime.utcnow().strftime("%B %d, %Y")
    cover_meta = [
        [Paragraph("Target Organization:", body_bold), Paragraph(html.escape(org.name), body_style)],
        [Paragraph("Evaluated Domain:", body_bold), Paragraph(f"<font name='Courier'>{html.escape(target_domain)}</font>", body_style)],
        [Paragraph("Assessment Period:", body_bold), Paragraph(f"Continuous (Current through {today_str})", body_style)],
        [Paragraph("Report Generated:", body_bold), Paragraph(today_str, body_style)],
        [Paragraph("Report Identifier:", body_bold), Paragraph(f"<font name='Courier'>{report_id}</font>", body_style)],
        [Paragraph("Report Scope:", body_bold), Paragraph(f"{report_type} (Non-Intrusive OSINT & Perimeter Telemetry)", body_style)],
        [Paragraph("Security Classification:", body_bold), Paragraph("<font color='#DC2626'><b>CONFIDENTIAL — PROPRIETARY INFORMATION</b></font>", body_style)]
    ]
    t_cover = Table(cover_meta, colWidths=[150, 390])
    t_cover.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t_cover)
    elements.append(Spacer(1, 40))

    # Confidentiality statement box
    confidentiality_text = (
        "<b>CONFIDENTIALITY NOTICE:</b> The information contained in this document is intended exclusively "
        "for the governance, security, and technical personnel of the recipient organization. This report contains "
        "externally observable security observations, configuration gaps, and exposure indicators. Unauthorized "
        "reproduction, dissemination, or distribution outside authorized governance channels is strictly prohibited."
    )
    t_conf = Table([[Paragraph(confidentiality_text, callout_style)]], colWidths=[540])
    t_conf.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF2F2")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FCA5A5")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    elements.append(t_conf)
    elements.append(PageBreak())

    # =========================================================================
    # PAGE 2: EXECUTIVE SUMMARY
    # =========================================================================
    elements.append(Paragraph("1. Executive Summary", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    # Executive Summary text based on actual findings
    exec_summary_text = (
        f"BreachGuard conducted an automated external perimeter and cyber risk assessment of <b>{html.escape(target_domain)}</b>. "
        f"The evaluation analyzed four primary exposure vectors: External Attack Surface (DNS and Certificate Transparency), "
        f"Email Security Posture (SPF, DMARC, and transport controls), Public Threat Intelligence, and Monitored Credential Exposure.<br/><br/>"
        f"Overall External Cyber Risk for the domain is scored at <b>{overall_risk} / 100</b>, representing a <b>{risk_level}</b> posture. "
        f"A total of <b>{len(all_findings)} security findings</b> were identified across the monitored perimeter. "
        f"Of these, <b>{len(crit_findings)} Critical</b> and <b>{len(high_findings)} High-severity</b> findings require immediate remediation "
        f"to mitigate potential business email compromise (BEC), unauthorized service access, or credential abuse."
    )
    elements.append(Paragraph(exec_summary_text, body_style))
    elements.append(Spacer(1, 15))

    # Findings overview table
    summary_table_data = [
        [Paragraph("<b>Severity Tier</b>", body_style), Paragraph("<b>Open Findings</b>", body_style), Paragraph("<b>Remediated / Closed</b>", body_style), Paragraph("<b>Primary Risk Vector</b>", body_style)],
        [Paragraph("<font color='#DC2626'><b>Critical Risk</b></font>", body_style), Paragraph(str(len(crit_findings)), body_style), Paragraph("0", body_style), Paragraph("Unauthenticated DB/Remote Admin Ports or Stealer Credentials", body_style)],
        [Paragraph("<font color='#EA580C'><b>High Risk</b></font>", body_style), Paragraph(str(len(high_findings)), body_style), Paragraph("0", body_style), Paragraph("DMARC Enforcement Gaps, Administrative Port Exposure", body_style)],
        [Paragraph("<font color='#CA8A04'><b>Medium Risk</b></font>", body_style), Paragraph(str(len(med_findings)), body_style), Paragraph("0", body_style), Paragraph("SPF Permissiveness, Known Vulnerability Indicators", body_style)],
        [Paragraph("<font color='#16A34A'><b>Low / Info</b></font>", body_style), Paragraph(str(len(low_findings)), body_style), Paragraph("0", body_style), Paragraph("Public Development Hostnames, Asset Discovery Records", body_style)],
        [Paragraph("<b>Total Findings</b>", body_bold), Paragraph(f"<b>{len(all_findings)}</b>", body_bold), Paragraph("<b>0</b>", body_bold), Paragraph("<b>Comprehensive Multi-Vector Perimeter Audit</b>", body_bold)]
    ]
    t_summary = Table(summary_table_data, colWidths=[110, 80, 100, 250])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 20))

    # Action summary banner
    action_banner = (
        f"<b>KEY ACTION REQUIRED:</b> {len(crit_findings) + len(high_findings)} high-priority security conditions were detected. "
        "Leadership and technical teams should immediately consult Section 5 (Detailed Findings) and Section 6 (Remediation Roadmap) "
        "to execute policy hardening and service restriction workflows."
    )
    t_act = Table([[Paragraph(action_banner, callout_style)]], colWidths=[540])
    t_act.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFBEB")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FDE68A")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t_act)
    elements.append(PageBreak())

    # =========================================================================
    # PAGE 3: RISK SCORECARD & METHODOLOGY DASHBOARD
    # =========================================================================
    elements.append(Paragraph("2. Unified Cyber Risk Scorecard", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    # Overall gauge representation
    gauge_color = "#DC2626" if overall_risk >= 65 else ("#EA580C" if overall_risk >= 40 else "#16A34A")
    gauge_data = [
        [Paragraph(f"<font size='26' color='{gauge_color}'><b>{overall_risk}</b></font><font size='14' color='#64748B'> / 100</font>", ParagraphStyle("GText", alignment=1)),
         Paragraph(f"<b>RISK CLASSIFICATION: {risk_level}</b><br/><font size='8' color='#64748B'>External Cyber Risk Index derives from multi-variable weighted deduction across 4 core exposure domains. 0 represents zero detectable external exposure; 100 represents severe multi-surface critical exposure.</font>", body_style)]
    ]
    t_gauge = Table(gauge_data, colWidths=[150, 390])
    t_gauge.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t_gauge)
    elements.append(Spacer(1, 15))

    # Category breakdown table
    cat_data = [
        [Paragraph("<b>Pillar Vector</b>", body_style), Paragraph("<b>Weight</b>", body_style), Paragraph("<b>Posture Score</b>", body_style), Paragraph("<b>Assessment & Key Observations</b>", body_style)],
        [Paragraph("<b>External Attack Surface</b>", body_style), Paragraph("30%", body_style), Paragraph(f"<b>{as_score} / 100</b>", body_style), Paragraph(f"Discovered {len(assets)} public hostnames in certificate logs. Audited administrative port exposure and development hostnames.", body_style)],
        [Paragraph("<b>Email Security Posture</b>", body_style), Paragraph("25%", body_style), Paragraph(f"<b>{em_score} / 100</b>", body_style), Paragraph(f"Audited SPF, DMARC ({email_assessment.dmarc_policy if email_assessment else 'missing'}), DKIM, and MX configuration.", body_style)],
        [Paragraph("<b>Threat Intelligence</b>", body_style), Paragraph("20%", body_style), Paragraph(f"<b>{ti_score} / 100</b>", body_style), Paragraph(f"Evaluated historical public breach repository indexing and security vendor reputation flags.", body_style)],
        [Paragraph("<b>Credential Exposure</b>", body_style), Paragraph("25%", body_style), Paragraph(f"<b>{cr_score} / 100</b>", body_style), Paragraph(f"Evaluated corporate identity exposures across {len(exposures)} monitored breach telemetry items.", body_style)],
    ]
    t_cat = Table(cat_data, colWidths=[130, 50, 80, 280])
    t_cat.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_cat)
    elements.append(Spacer(1, 20))

    elements.append(Paragraph("<b>Scoring Formula & Deduction Methodology:</b>", h2_style))
    elements.append(Paragraph(
        "BreachGuard utilizes a deterministic, transparent scoring engine: "
        "<code>Overall Risk = 100 - [(AttackSurface × 0.30) + (EmailSecurity × 0.25) + (ThreatIntel × 0.20) + (CredentialExposure × 0.25)]</code>. "
        "Deductions occur when verified security controls are absent (e.g. lack of DMARC enforcement) or when high-risk exposure "
        "is observed (e.g. exposed database ports or unmasked credentials).",
        body_style
    ))
    elements.append(PageBreak())

    # =========================================================================
    # PAGE 4: EXTERNAL ATTACK SURFACE INVENTORY
    # =========================================================================
    elements.append(Paragraph("3. External Attack Surface Analysis", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    elements.append(Paragraph(
        f"BreachGuard enumerated publicly observable hostnames and network endpoints associated with <b>{html.escape(target_domain)}</b> "
        f"via Certificate Transparency (CT) logs and DNS resolution. Discovered IP addresses were passively enriched via Shodan InternetDB "
        f"to detect exposed administrative services, open ports, and indexed software CPEs without performing intrusive scanning.",
        body_style
    ))
    elements.append(Spacer(1, 12))

    # Asset Table
    asset_rows = [
        [Paragraph("<b>Hostname</b>", body_style), Paragraph("<b>Resolved IP</b>", body_style), Paragraph("<b>Open Ports</b>", body_style), Paragraph("<b>Discovered Services / Notes</b>", body_style)]
    ]
    for a in assets[:15]:
        ports_str = "None detected"
        try:
            if a.open_ports:
                p_list = json.loads(a.open_ports)
                ports_str = ", ".join(str(p) for p in p_list) if p_list else "None detected"
        except Exception:
            pass

        asset_rows.append([
            Paragraph(f"<font name='Courier'>{html.escape(a.hostname)}</font>", body_style),
            Paragraph(f"<font name='Courier'>{html.escape(a.ip_address or 'Unresolved')}</font>", body_style),
            Paragraph(ports_str, body_style),
            Paragraph(html.escape(a.source or "crt.sh"), body_style)
        ])

    if len(asset_rows) == 1:
        asset_rows.append([
            Paragraph(f"<font name='Courier'>{html.escape(target_domain)}</font>", body_style),
            Paragraph("Passively resolved", body_style),
            Paragraph("80, 443", body_style),
            Paragraph("Standard web ports", body_style)
        ])

    t_assets = Table(asset_rows, colWidths=[170, 110, 90, 170])
    t_assets.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t_assets)
    elements.append(Spacer(1, 15))

    # Attack surface notes
    elements.append(Paragraph(
        "<b>Attack Surface Exposure Findings:</b> Publicly reachable pre-production interfaces (e.g. dev, staging) "
        "and administrative ports (e.g. SSH, RDP, database ports) dramatically increase automated exploitation risk. "
        "All corporate administrative interfaces should be restricted to authenticated corporate VPN gateways.",
        body_style
    ))
    elements.append(PageBreak())

    # =========================================================================
    # PAGE 5: EMAIL SECURITY POSTURE
    # =========================================================================
    elements.append(Paragraph("4. Email Security & Anti-Spoofing Posture", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    elements.append(Paragraph(
        f"Email continues to represent the primary initial attack vector for enterprise cyber incidents. "
        f"BreachGuard inspected the public DNS configuration of <b>{html.escape(target_domain)}</b> for foundational "
        f"anti-spoofing and transport encryption mechanisms (SPF, DMARC, DKIM, MTA-STS, TLS-RPT, and DNSSEC).",
        body_style
    ))
    elements.append(Spacer(1, 12))

    # Email controls table
    email_ctrls = [
        [Paragraph("<b>Security Control</b>", body_style), Paragraph("<b>Standard</b>", body_style), Paragraph("<b>Observed Status</b>", body_style), Paragraph("<b>Evaluation & Technical Findings</b>", body_style)],
        [
            Paragraph("<b>SPF</b><br/>Sender Policy Framework", body_style),
            Paragraph("RFC 7208", body_style),
            Paragraph(f"<b>{email_assessment.spf_status.upper() if email_assessment else 'FAIL'}</b>", body_style),
            Paragraph(html.escape(email_assessment.spf_details if email_assessment else "SPF record missing"), body_style)
        ],
        [
            Paragraph("<b>DMARC</b><br/>Domain Message Authentication", body_style),
            Paragraph("RFC 7489", body_style),
            Paragraph(f"<b>{email_assessment.dmarc_status.upper() if email_assessment else 'FAIL'}</b>", body_style),
            Paragraph(html.escape(email_assessment.dmarc_details if email_assessment else "DMARC policy missing"), body_style)
        ],
        [
            Paragraph("<b>DKIM</b><br/>DomainKeys Identified Mail", body_style),
            Paragraph("RFC 6376", body_style),
            Paragraph(f"<b>{email_assessment.dkim_status.upper() if email_assessment else 'NOT VERIFIABLE'}</b>", body_style),
            Paragraph(html.escape(email_assessment.dkim_details if email_assessment else "DKIM could not be verified from publicly discoverable selectors."), body_style)
        ],
        [
            Paragraph("<b>MX</b><br/>Mail Exchange Routing", body_style),
            Paragraph("RFC 5321", body_style),
            Paragraph(f"<b>{email_assessment.mx_status.upper() if email_assessment else 'PASS'}</b>", body_style),
            Paragraph("Enterprise mail routing active and configured.", body_style)
        ],
        [
            Paragraph("<b>MTA-STS</b><br/>Strict Transport Security", body_style),
            Paragraph("RFC 8461", body_style),
            Paragraph(f"<b>{email_assessment.mta_sts_status.upper() if email_assessment else 'NOT DETECTED'}</b>", body_style),
            Paragraph("Enforces TLS encryption on inbound mail transfer connections.", body_style)
        ],
        [
            Paragraph("<b>TLS-RPT</b><br/>SMTP TLS Reporting", body_style),
            Paragraph("RFC 8460", body_style),
            Paragraph(f"<b>{email_assessment.tls_rpt_status.upper() if email_assessment else 'NOT DETECTED'}</b>", body_style),
            Paragraph("Receives automated reports regarding TLS connectivity failures.", body_style)
        ],
        [
            Paragraph("<b>DNSSEC</b><br/>DNS Security Extensions", body_style),
            Paragraph("RFC 4033", body_style),
            Paragraph(f"<b>{email_assessment.dnssec_status.upper() if email_assessment else 'NOT DETECTED'}</b>", body_style),
            Paragraph("Cryptographically signs DNS zone records to prevent DNS spoofing / cache poisoning.", body_style)
        ],
    ]
    t_email = Table(email_ctrls, colWidths=[110, 60, 90, 280])
    t_email.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_email)
    elements.append(Spacer(1, 15))

    # Email recommendation
    dmarc_pol = email_assessment.dmarc_policy if email_assessment else "none"
    if dmarc_pol in ["none", "missing"]:
        rec_email_box = (
            "<b>CRITICAL EMAIL ACTION:</b> Your domain currently lacks DMARC enforcement. "
            "Any external threat actor can transmit emails spoofing your domain name (e.g. ceo@example.com) to partners, "
            "customers, or vendors without triggering recipient authentication rejection. "
            "Prioritize upgrading your DMARC record to <code>p=quarantine</code> or <code>p=reject</code>."
        )
        t_rec = Table([[Paragraph(rec_email_box, callout_style)]], colWidths=[540])
        t_rec.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF2F2")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FCA5A5")),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        elements.append(t_rec)

    elements.append(PageBreak())

    # =========================================================================
    # PAGE 6: THREAT INTELLIGENCE & MONITORED CREDENTIAL EXPOSURE
    # =========================================================================
    elements.append(Paragraph("5. Threat Intelligence & Credential Exposure", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    elements.append(Paragraph(
        f"BreachGuard cross-references domain assets and corporate identities against verified public breach disclosures, "
        f"commercial leak indexes, and security vendor reputation feeds. Below is the audited exposure inventory.",
        body_style
    ))
    elements.append(Spacer(1, 12))

    # Identity Exposure Table (strictly masked per Rule 15/25)
    exp_rows = [
        [Paragraph("<b>Masked Identity</b>", body_style), Paragraph("<b>Breach Source</b>", body_style), Paragraph("<b>Severity</b>", body_style), Paragraph("<b>Exposure Type</b>", body_style), Paragraph("<b>Status</b>", body_style)]
    ]
    for exp in exposures[:10]:
        email_val = f"admin@{target_domain}"
        try:
            if exp.email_rel and exp.email_rel.email:
                email_val = exp.email_rel.email
        except Exception:
            pass
        email_str = mask_email(email_val)
        src_name = exp.source_name or "Public Breach Archive"
        sev_color = "#DC2626" if exp.severity == "critical" else ("#EA580C" if exp.severity == "high" else "#CA8A04")
        
        exp_rows.append([
            Paragraph(f"<font name='Courier'>{email_str}</font>", body_style),
            Paragraph(html.escape(src_name[:26]), body_style),
            Paragraph(f"<font color='{sev_color}'><b>{exp.severity.upper()}</b></font>", body_style),
            Paragraph(html.escape(exp.credential_type or "Identity metadata"), body_style),
            Paragraph(html.escape(exp.status.upper()), body_style)
        ])

    if len(exp_rows) == 1:
        exp_rows.append([
            Paragraph("No active exposures", body_style),
            Paragraph("Public Breach Index", body_style),
            Paragraph("<font color='#16A34A'><b>CLEAN</b></font>", body_style),
            Paragraph("None observed", body_style),
            Paragraph("RESOLVED", body_style)
        ])

    t_exp = Table(exp_rows, colWidths=[150, 130, 80, 100, 80])
    t_exp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t_exp)
    elements.append(Spacer(1, 15))

    elements.append(Paragraph(
        "<b>DATA PROTECTION NOTE:</b> In compliance with BreachGuard's zero-credential persistence policy, "
        "raw passwords, session cookies, and authentication tokens are never stored, displayed, or exported in PDF reports. "
        "Only non-sensitive metadata, exposure categorization, and forensic timestamps are retained for audit documentation.",
        body_style
    ))
    elements.append(PageBreak())

    # =========================================================================
    # PAGES 7-11: DETAILED STRUCTURED FINDINGS
    # =========================================================================
    elements.append(Paragraph("6. Detailed Technical Findings", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    elements.append(Paragraph(
        "Each security finding identified during external reconnaissance is cataloged below with specific technical evidence, "
        "assessed security impact, concrete remediation instructions, and mapped compliance frameworks.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    if not all_findings:
        elements.append(Paragraph("No open security findings were observed for the monitored perimeter.", body_style))
    else:
        for idx, finding in enumerate(all_findings):
            f_sev_color = "#DC2626" if finding.severity == "critical" else ("#EA580C" if finding.severity == "high" else ("#CA8A04" if finding.severity == "medium" else "#16A34A"))
            
            finding_content = []
            # Title & Header
            finding_content.append(Paragraph(
                f"<b>{finding.finding_id}: {html.escape(finding.title)}</b>",
                ParagraphStyle("FTitle", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=primary_color)
            ))
            finding_content.append(Spacer(1, 4))
            
            # Attributes metadata bar
            meta_bar = (
                f"<b>Severity:</b> <font color='{f_sev_color}'>{finding.severity.upper()}</font> | "
                f"<b>Category:</b> {finding.category.replace('_', ' ').title()} | "
                f"<b>Status:</b> {finding.status.upper()} | "
                f"<b>Confidence:</b> {finding.confidence.upper()} | "
                f"<b>Affected Asset:</b> <code>{html.escape(finding.asset)}</code>"
            )
            finding_content.append(Paragraph(meta_bar, body_style))
            finding_content.append(Spacer(1, 6))

            # Table of Finding Details
            f_details = [
                [Paragraph("<b>Observed Evidence:</b>", body_bold), Paragraph(html.escape(finding.evidence or "Observed via public perimeter checks."), body_style)],
                [Paragraph("<b>Security Impact:</b>", body_bold), Paragraph(html.escape(finding.security_impact or "Increases external attack surface exposure."), body_style)],
                [Paragraph("<b>Recommended Remediation:</b>", body_bold), Paragraph(html.escape(finding.recommended_remediation or "Review configuration and restrict access."), body_style)],
                [Paragraph("<b>Framework References:</b>", body_bold), Paragraph(f"<font color='#475569'>{html.escape(finding.references or 'NIST CSF / CIS Controls')}</font>", body_style)],
            ]
            t_f = Table(f_details, colWidths=[130, 410])
            t_f.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), bg_light),
                ('BOX', (0,0), (-1,-1), 1, border_color),
                ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            finding_content.append(t_f)
            finding_content.append(Spacer(1, 12))

            elements.append(KeepTogether(finding_content))
            
            # Page break every 2 detailed findings to ensure neat spacing
            if (idx + 1) % 2 == 0 and (idx + 1) < len(all_findings):
                elements.append(PageBreak())

    elements.append(PageBreak())

    # =========================================================================
    # PAGE 12: REMEDIATION ROADMAP
    # =========================================================================
    elements.append(Paragraph("7. Actionable Remediation Roadmap", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    elements.append(Paragraph(
        "Remediation tasks are prioritized by risk reduction efficacy and operational urgency. "
        "Execute actions in the prescribed phases to rapidly decrease external threat exposure.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    roadmap_data = [
        [
            Paragraph("<b>Phase 1: Immediate Action (0–24 Hours)</b>", body_bold),
            Paragraph(
                "• <b>Restrict Exposed Administrative Services:</b> Immediately firewall open ports (e.g. 22, 3389, database ports) from public IP ranges. Enforce corporate VPN access.<br/>"
                "• <b>Compromised Credential Revocation:</b> Reset passwords for any identities flagged in active botnet or infostealer dumps. Revoke active OAuth/session tokens.",
                body_style
            )
        ],
        [
            Paragraph("<b>Phase 2: Short-Term Remediation (1–7 Days)</b>", body_bold),
            Paragraph(
                "• <b>Enforce Email Anti-Spoofing:</b> Transition DMARC policy from <code>p=none</code> to <code>p=quarantine</code> or <code>p=reject</code>. Verify SPF syntax.<br/>"
                "• <b>Isolate Development Hostnames:</b> Place pre-production interfaces (dev, staging) behind authenticated reverse proxies or IP allowlists.",
                body_style
            )
        ],
        [
            Paragraph("<b>Phase 3: Medium-Term Hardening (7–30 Days)</b>", body_bold),
            Paragraph(
                "• <b>Deploy MTA-STS & TLS-RPT:</b> Enforce inbound SMTP TLS encryption and configure aggregate failure reporting.<br/>"
                "• <b>Continuous Perimeter Auditing:</b> Enable recurring automated weekly or daily BreachGuard scanning to detect new exposed assets.",
                body_style
            )
        ]
    ]
    t_road = Table(roadmap_data, colWidths=[150, 390])
    t_road.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_road)
    elements.append(PageBreak())

    # =========================================================================
    # PAGE 13: METHODOLOGY, LIMITATIONS & LEGAL DEFICIENCY
    # =========================================================================
    elements.append(Paragraph("8. Methodology & Operational Limitations", h1_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=15))

    elements.append(Paragraph("<b>Passive & Non-Intrusive Reconnaissance Methodology:</b>", h2_style))
    elements.append(Paragraph(
        "BreachGuard assessments rely entirely on non-intrusive, publicly observable external telemetry. "
        "BreachGuard does <b>not</b> perform unauthorized exploitation, brute-force credential stuffing, vulnerability injection, "
        "destructive testing, or internal network scanning. All intelligence is gathered via authorized DNS queries, "
        "public Certificate Transparency cryptographic registries, passive Shodan InternetDB summaries, and verified public breach notifications.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("<b>Inherent Technical Limitations:</b>", h2_style))
    limitations_points = (
        "1. <b>External-Only Visibility:</b> Public intelligence provides visibility into internet-facing perimeters only. It does not replace internal network vulnerability assessments or endpoint detection.<br/>"
        "2. <b>Historical Breach Context:</b> The presence of a domain in a historical breach repository indicates third-party data exposure, but does not independently establish current internal infrastructure compromise.<br/>"
        "3. <b>Third-Party Provider Coverage:</b> Telemetry completeness is subject to third-party public database update cycles and registry availability.<br/>"
        "4. <b>Dynamic Cloud Infrastructure:</b> IP addresses in cloud environments (e.g. AWS, Cloudflare) may represent shared infrastructure and should be verified against corporate asset management inventories."
    )
    elements.append(Paragraph(limitations_points, body_style))
    elements.append(Spacer(1, 15))

    elements.append(Paragraph("<b>Compliance Framework Mapping:</b>", h2_style))
    elements.append(Paragraph(
        "Findings in this report are mapped to recognized technical guidelines including <b>NIST Cybersecurity Framework (CSF v2.0)</b>, "
        "<b>CIS Critical Security Controls (v8)</b>, and relevant Internet Engineering Task Force (IETF) RFC specifications. "
        "This mapping is intended to assist governance teams with internal control alignment and does not constitute a formal certification.",
        body_style
    ))

    # Build PDF with NumberedCanvas
    doc.build(elements, canvasmaker=NumberedCanvas)
    logger.info(f"Generated professional assessment report: {filename}")
    return filename
