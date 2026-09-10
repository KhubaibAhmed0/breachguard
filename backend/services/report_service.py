import os
import uuid
import html
import logging
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.exposure import Exposure
from models.domain import MonitoredDomain, MonitoredEmail
from models.organization import Organization
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable, Image as RLImage
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
        self.drawString(36, 22, "BreachGuard Threat Intelligence | STRICTLY CONFIDENTIAL | External Exposure Assessment")
        self.drawRightString(letter[0] - 36, 22, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(36, 32, letter[0] - 36, 32)
        self.restoreState()


def get_provenance_info(exp: Exposure) -> Tuple[str, str, str]:
    """
    Derives technical provenance (telemetry class, evidence metadata type, confidence level)
    without ever exposing sensitive raw secret strings.
    """
    src_type = (exp.source_type or "").lower()
    src_name = (exp.source_name or "").lower()
    cred_type = (exp.credential_type or "breach").lower()

    # 1. Telemetry Class
    if "stealer" in src_name or src_type == "stealer_log":
        telemetry_class = "Infostealer Telemetry"
    elif src_type == "paste":
        telemetry_class = "Dark-Web Paste Archive"
    elif "dump" in src_name or "leak" in src_name:
        telemetry_class = "Commercial Leak Index"
    else:
        telemetry_class = "Public Breach Repository"

    # 2. Evidence Type
    if cred_type == "plaintext":
        evidence_type = "Credential metadata (plaintext)"
    elif cred_type == "hashed":
        evidence_type = "Credential metadata (hash)"
    elif cred_type == "api_token":
        evidence_type = "Secret / token metadata"
    elif cred_type == "domain_breach":
        evidence_type = "Breach disclosure index"
    else:
        evidence_type = f"Identity record ({cred_type})"

    # 3. Confidence
    confidence = "High (Verified)" if exp.severity in ["critical", "high"] else "Moderate"

    return telemetry_class, evidence_type, confidence


async def generate_pdf_report(
    org_id: int, 
    report_type: str = "Executive", 
    domain_name: Optional[str] = None, 
    db: AsyncSession = None
) -> str:
    """
    Generates a professional, legally defensible, enterprise-grade PDF audit report
    accurately reflecting exposure findings, risk scores, provenance, and remediation status.
    """
    # 1. Fetch organization details
    org_res = await db.execute(select(Organization).where(Organization.id == org_id))
    org_obj = org_res.scalars().first()
    org_name = org_obj.name if org_obj else "Enterprise Security"

    # 2. Scope & Exposure Gathering
    target_scope = "All Monitored Perimeter Domains"
    is_domain_specific = bool(domain_name and domain_name.strip() and domain_name.strip().lower() != "all")
    clean_domain = domain_name.strip().lower() if is_domain_specific else None

    if is_domain_specific:
        target_scope = clean_domain
        # Find domain object under this org
        res = await db.execute(
            select(MonitoredDomain).where(
                MonitoredDomain.org_id == org_id, 
                MonitoredDomain.domain == clean_domain
            )
        )
        domain_obj = res.scalars().first()

        # If not found in current org, seed it strictly for this org
        if not domain_obj:
            domain_obj = MonitoredDomain(org_id=org_id, domain=clean_domain, verified=True, scan_frequency="daily")
            db.add(domain_obj)
            await db.commit()
            await db.refresh(domain_obj)

            # Trigger fresh scan for this org
            from services.scan_service import run_domain_scan
            try:
                await run_domain_scan(domain_obj.id, db)
            except Exception as e:
                logger.error(f"Error scanning domain {clean_domain}: {e}")

        # Fetch emails and exposures for domain_obj
        e_res = await db.execute(select(MonitoredEmail).where(MonitoredEmail.domain_id == domain_obj.id))
        domain_emails = e_res.scalars().all()
        email_map = {e.id: e.email for e in domain_emails}

        if domain_emails:
            exp_res = await db.execute(select(Exposure).where(Exposure.email_id.in_(list(email_map.keys()))))
            exposures = exp_res.scalars().all()
        else:
            exposures = []

    else:
        # Organization wide
        exp_res = await db.execute(select(Exposure).where(Exposure.org_id == org_id))
        exposures = exp_res.scalars().all()
        email_ids = list(set(e.email_id for e in exposures))
        if email_ids:
            em_res = await db.execute(select(MonitoredEmail).where(MonitoredEmail.id.in_(email_ids)))
            email_map = {e.id: e.email for e in em_res.scalars().all()}
        else:
            email_map = {}

    # 3. Categorization and Status Analysis
    total_exposures = len(exposures)
    open_exposures = [e for e in exposures if (e.status or "open").lower() == "open"]
    remediated_exposures = [e for e in exposures if (e.status or "").lower() == "remediated"]
    open_count = len(open_exposures)
    remediated_count = len(remediated_exposures)

    crit_count = sum(1 for e in exposures if e.severity == "critical")
    high_count = sum(1 for e in exposures if e.severity == "high")
    med_count = sum(1 for e in exposures if e.severity == "medium")
    low_count = sum(1 for e in exposures if e.severity == "low")

    open_crit = sum(1 for e in open_exposures if e.severity == "critical")
    open_high = sum(1 for e in open_exposures if e.severity == "high")
    open_med = sum(1 for e in open_exposures if e.severity == "medium")
    open_low = sum(1 for e in open_exposures if e.severity == "low")

    # 4. Clear, Direction-Obvious Risk Score (0 = Clean/Lowest Risk, 100 = Maximum Risk)
    if total_exposures == 0:
        risk_score = 0
        risk_badge = "LOW RISK &bull; CLEAN PERIMETER"
        score_color = colors.HexColor('#16A34A')
        badge_text_color = colors.HexColor('#166534')
    elif open_count == 0 and remediated_count > 0:
        # Cleaned of open items: explicit wording avoiding absolute 'all remediated'
        risk_score = 15
        risk_badge = "LOW RESIDUAL RISK &bull; NO OPEN FINDINGS"
        score_color = colors.HexColor('#16A34A')
        badge_text_color = colors.HexColor('#166534')
    else:
        # Calculate active risk based on open exposures
        calc_risk = (open_crit * 40) + (open_high * 25) + (open_med * 10) + (open_low * 3) + (remediated_count * 2)
        risk_score = max(20, min(100, calc_risk))

        if risk_score >= 70:
            score_color = colors.HexColor('#DC2626')
            risk_badge = "HIGH RISK &bull; ACTION REQUIRED"
            badge_text_color = colors.HexColor('#991B1B')
        elif risk_score >= 35:
            score_color = colors.HexColor('#EA580C')
            risk_badge = "MODERATE RISK &bull; ACTION REQUIRED"
            badge_text_color = colors.HexColor('#9A3412')
        else:
            score_color = colors.HexColor('#16A34A')
            risk_badge = "LOW RISK &bull; SATISFACTORY"
            badge_text_color = colors.HexColor('#166534')

    # 5. Setup ReportLab Document
    reports_dir = "reports"
    os.makedirs(reports_dir, exist_ok=True)
    report_uuid = uuid.uuid4().hex[:8].upper()
    
    if is_domain_specific:
        clean_file_part = "".join(c for c in clean_domain if c.isalnum() or c in ".-_")
        filename = f"Security_Report_{clean_file_part}_{report_uuid}.pdf"
    else:
        filename = f"Security_Report_All_Domains_{report_uuid}.pdf"

    filepath = os.path.join(reports_dir, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()

    # Typography & styles
    h1 = ParagraphStyle('DocTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#0F172A'))
    h2 = ParagraphStyle('SectionTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=colors.HexColor('#0F172A'), spaceBefore=8, spaceAfter=4)
    sub = ParagraphStyle('SubTitle', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=12, textColor=colors.HexColor('#64748B'))
    body = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11.5, textColor=colors.HexColor('#334155'))
    small = ParagraphStyle('Small', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#64748B'))
    table_cell = ParagraphStyle('Cell', parent=styles['Normal'], fontName='Helvetica', fontSize=7, leading=9.5, textColor=colors.HexColor('#1E293B'))
    table_cell_bold = ParagraphStyle('CellB', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=10, textColor=colors.HexColor('#0F172A'))
    table_header = ParagraphStyle('TableHead', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=10, textColor=colors.white)
    callout_style = ParagraphStyle('Callout', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#78350F'))

    story = []

    # --- Top Classification Bar ---
    classification_color = '#DC2626' if risk_score >= 70 else '#EA580C' if risk_score >= 35 else '#16A34A'
    top_bar = Table([
        [Paragraph("<b>BREACHGUARD THREAT INTELLIGENCE PLATFORM</b>", ParagraphStyle('TBarL', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#0F172A'))),
         Paragraph("<b>SECURITY CLASSIFICATION: TLP:AMBER / CONFIDENTIAL AUDIT</b>", ParagraphStyle('TBarR', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor(classification_color), alignment=2))]
    ], colWidths=[310, 230])
    top_bar.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(top_bar)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0F172A'), spaceBefore=2, spaceAfter=6))

    # --- Document Header & Subtitle (with Organization Co-branding Logo if enabled) ---
    report_title = f"External Exposure Assessment Report: {report_type}"
    title_flowables = [
        Paragraph(report_title, h1),
        Paragraph(f"Threat-Intelligence Telemetry & Credential Reconnaissance &bull; Scope: <b>{target_scope}</b>", sub)
    ]

    has_custom_logo = (
        org_obj 
        and org_obj.logo_path 
        and os.path.exists(org_obj.logo_path) 
        and (org_obj.plan or "").lower() in ['business', 'enterprise', 'enterprise / msp', 'professional']
    )

    if has_custom_logo:
        try:
            logo_element = RLImage(org_obj.logo_path, width=110, height=36, kind='proportional')
            header_table = Table([
                [title_flowables, logo_element]
            ], colWidths=[420, 120])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (1,0), (1,0), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(header_table)
        except Exception as e:
            logger.warning(f"Could not load custom organization logo: {e}")
            story.extend(title_flowables)
    else:
        story.extend(title_flowables)

    story.append(Spacer(1, 6))

    # --- Metadata Grid (4 Columns) ---
    current_time_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    meta_data = [
        [
            Paragraph(f"<b>Target Scope:</b><br/>{target_scope}", table_cell),
            Paragraph(f"<b>Audited Organization:</b><br/>{org_name}", table_cell),
            Paragraph(f"<b>Audit Reference:</b><br/>BG-EXP-{report_uuid}", table_cell),
            Paragraph(f"<b>Assessment Date:</b><br/>{current_time_str}", table_cell)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[135, 135, 135, 135])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 7))

    # --- Executive Posture / Risk Scorecard Card ---
    score_cell = [
        Spacer(1, 2),
        Paragraph("RISK SCORE", ParagraphStyle('ScoreLbl', fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.HexColor('#64748B'))),
        Paragraph("<font size=6.5 color='#94A3B8'>Scale: 0 = Low Risk &bull; 100 = Max Risk</font>", ParagraphStyle('ScoreDir', fontName='Helvetica', fontSize=6.5, alignment=1, textColor=colors.HexColor('#94A3B8'))),
        Spacer(1, 3),
        Paragraph(f"{risk_score} <font size=12 color='#94A3B8'>/ 100</font>", ParagraphStyle('ScoreNum', fontName='Helvetica-Bold', fontSize=28, leading=30, alignment=1, textColor=score_color)),
        Spacer(1, 3),
        Paragraph(f"<b>{risk_badge}</b>", ParagraphStyle('ScoreBadge', fontName='Helvetica-Bold', fontSize=6.5, alignment=1, textColor=badge_text_color)),
        Spacer(1, 2),
    ]

    stats_cell = [
        Paragraph("<b>EXPOSURE SEVERITY & STATUS BREAKDOWN</b>", ParagraphStyle('BreakLbl', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0F172A'))),
        Spacer(1, 2),
        Table([
            [Paragraph("Total Detected Exposure Records", table_cell_bold), Paragraph(f"<b>{total_exposures}</b>", table_cell_bold)],
            [Paragraph("Active Open Findings (Require Validation)", table_cell), Paragraph(f"<font color='{'#DC2626' if open_count > 0 else '#16A34A'}'><b>{open_count}</b></font>", table_cell)],
            [Paragraph("Remediation Status: Marked Remediated in BreachGuard", table_cell), Paragraph(f"<font color='#16A34A'><b>{remediated_count}</b></font>", table_cell)],
            [Paragraph("Critical Severity (Plaintext / Stealer Telemetry)", table_cell), Paragraph(f"<font color='#DC2626'><b>{crit_count}</b></font>", table_cell)],
            [Paragraph("High / Medium Severity (Breach Dumps / Hashes)", table_cell), Paragraph(f"<font color='#EA580C'><b>{high_count + med_count}</b></font>", table_cell)],
        ], colWidths=[255, 45], style=[
            ('LINEBELOW', (0,0), (-1,-2), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0,0), (-1,-1), 1.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ])
    ]

    summary_card = Table([[score_cell, stats_cell]], colWidths=[195, 345])
    summary_card.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (1,0), (1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('LINEBEFORE', (1,0), (1,0), 1, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(summary_card)
    story.append(Spacer(1, 6))

    # --- Defensible Triage Callout Banner ---
    callout_box = Table([
        [
            Paragraph(
                "<b>Important Triage Distinction:</b> BreachGuard identified an exposure associated with this corporate identity in a threat-intelligence source. "
                "The available telemetry indicates potential credential compromise. "
                "The organization should independently validate whether the credential or session remains active within its environment. "
                "Detection of an exposure record confirms that identity artifacts appeared in monitored intelligence datasets; "
                "<b>it does not prove an active, ongoing compromise of the endpoint or live account</b>.",
                callout_style
            )
        ]
    ], colWidths=[540])
    callout_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFBEB')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#FDE68A')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(callout_box)
    story.append(Spacer(1, 6))

    # --- Executive Narrative (Context-Aware based on Open vs Remediated, No Duplication) ---
    story.append(Paragraph("Threat Intelligence Summary & Assessment", h2))
    if open_count > 0:
        narrative_text = (
            f"BreachGuard aggregates, normalizes, and correlates external telemetry across specialized threat-intelligence sources, "
            f"public breach repositories, and commercial leak indexes. For target perimeter <b>{target_scope}</b>, "
            f"BreachGuard identified <b>{total_exposures} exposure record(s)</b>, with <b>{open_count} active open finding(s)</b> requiring validation. "
            f"The available telemetry indicates potential credential compromise. The organization should independently validate "
            f"whether the credential or session remains active and initiate defensive mitigations."
        )
    elif total_exposures > 0 and open_count == 0:
        narrative_text = (
            f"BreachGuard aggregates, normalizes, and correlates external telemetry across specialized threat-intelligence sources, "
            f"public breach repositories, and commercial leak indexes. All <b>{total_exposures} detected exposure record(s)</b> "
            f"matching target perimeter <b>{target_scope}</b> currently hold the status of <b>Marked Remediated in BreachGuard</b>. "
            f"Organizations should independently verify password rotation, session revocation, and endpoint hygiene "
            f"to validate that defensive controls have been executed internally."
        )
    else:
        narrative_text = (
            f"BreachGuard continuous surveillance evaluated target perimeter <b>{target_scope}</b> against syndicated threat-intelligence feeds "
            f"and public breach repositories. No exposure records matching this monitored perimeter were detected in current intelligence datasets. "
            f"Preventive perimeter hardening and continuous surveillance remain active."
        )
    story.append(Paragraph(narrative_text, body))
    story.append(Spacer(1, 6))

    # --- Detailed Exposure Inventory with Technical Provenance ---
    story.append(Paragraph("Identified Threat-Intelligence Exposure Findings & Provenance", h2))
    
    table_headers = [
        Paragraph("Associated Identity", table_header),
        Paragraph("Source & Feed", table_header),
        Paragraph("Telemetry Class", table_header),
        Paragraph("Severity Triage", table_header),
        Paragraph("Evidence & Confidence", table_header),
        Paragraph("Remediation Status", table_header),
    ]
    rows = [table_headers]

    if exposures:
        for exp in exposures[:25]:
            email_addr = email_map.get(exp.email_id, "corporate-identity")
            telemetry_class, evidence_type, confidence = get_provenance_info(exp)

            # Severity triage styling
            sev = (exp.severity or "low").upper()
            if sev == "CRITICAL":
                sev_html = "<font color='#DC2626'><b>CRITICAL</b></font>"
            elif sev == "HIGH":
                sev_html = "<font color='#EA580C'><b>HIGH</b></font>"
            elif sev == "MEDIUM":
                sev_html = "<font color='#D97706'><b>MEDIUM</b></font>"
            else:
                sev_html = "<font color='#2563EB'><b>LOW</b></font>"

            det_date = exp.detected_at.strftime("%Y-%m-%d") if exp.detected_at else "Historical"
            status_str = (exp.status or "Open").capitalize()
            
            # Status distinction
            if status_str.lower() == 'remediated':
                status_html = "<font color='#16A34A'><b>Marked Remediated</b></font><br/><font size=6 color='#64748B'>in BreachGuard</font>"
            else:
                status_html = "<font color='#DC2626'><b>Open</b></font><br/><font size=6 color='#DC2626'>Action Required</font>"

            rows.append([
                Paragraph(f"<b>{email_addr}</b><br/><font size=6 color='#64748B'>Observed: {det_date}</font>", table_cell),
                Paragraph(f"<b>{exp.source_name or 'Syndicated Feed'}</b><br/><font size=6 color='#64748B'>External Provider</font>", table_cell),
                Paragraph(telemetry_class, table_cell),
                Paragraph(f"{sev_html}<br/><font size=6 color='#64748B'>Priority Triage</font>", table_cell),
                Paragraph(f"{evidence_type}<br/><font size=6 color='#166534'>Conf: {confidence}</font>", table_cell),
                Paragraph(status_html, table_cell),
            ])
    else:
        rows.append([
            Paragraph("No exposure records detected matching this target perimeter.", table_cell),
            Paragraph("-", table_cell),
            Paragraph("-", table_cell),
            Paragraph("<font color='#16A34A'>CLEAN</font>", table_cell),
            Paragraph("Zero telemetry match", table_cell),
            Paragraph("<font color='#16A34A'>Monitored</font>", table_cell),
        ])

    findings_table = Table(rows, colWidths=[115, 100, 95, 60, 95, 75])
    findings_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(findings_table)
    story.append(Spacer(1, 7))

    # --- Technical Context: Infostealer Telemetry vs Historical Breaches ---
    story.append(Paragraph("Technical Context: Infostealer Telemetry vs Historical Breaches", h2))
    vectors_data = [
        [
            Paragraph("<b>Infostealer Malware Telemetry (Critical Severity Triage)</b><br/>"
                      "Infostealers (e.g. RedLine, Lumma, Vidar, Stealc) are malware strains that harvest data directly from infected endpoints, "
                      "extracting stored browser credentials, autofill data, device fingerprints, and <b>active browser session tokens / cookies</b>. "
                      "Unlike static legacy breach dumps, stealer-log telemetry indicates potential endpoint compromise where active session tokens could "
                      "allow threat actors to bypass Multi-Factor Authentication (MFA) without passwords or OTP prompts. "
                      "That is why stealer-log telemetry is classified as Critical Priority, requiring immediate session revocation and endpoint inspection.", body)
        ],
        [
            Paragraph("<b>Historical Database Breaches & Indexes (High / Medium Severity Triage)</b><br/>"
                      "Represents corporate email addresses exposed during third-party SaaS compromises or public leak aggregations (e.g. public disclosure dumps). "
                      "The primary threat vector is <i>credential reuse</i> (an employee reusing their corporate password on an external service). "
                      "These exposures require password rotation and MFA enforcement, but do not imply endpoint infection.", body)
        ]
    ]
    vec_table = Table(vectors_data, colWidths=[540])
    vec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(vec_table)
    story.append(Spacer(1, 7))

    # --- Remediation Plan (Differentiated for Open vs Marked Remediated) ---
    if open_count > 0:
        story.append(Paragraph("Prioritized Incident Response & Remediation Plan", h2))
        open_email_names = list(set(email_map.get(e.email_id, "affected account") for e in open_exposures))
        email_str_preview = ", ".join(open_email_names[:3])
        if len(open_email_names) > 3:
            email_str_preview += f" (+{len(open_email_names)-3} more)"

        actions = [
            [Paragraph("<b>Priority 1: Immediate Containment (Within 24 Hours)</b>", table_cell_bold)],
            [Paragraph(f"&bull; <b>Revoke Active Sessions:</b> Invalidate session tokens, OAuth grants, and browser cookies for flagged identities ({email_str_preview}). "
                       f"Password resets alone are insufficient if threat actors possess valid session tokens.<br/>"
                       f"&bull; <b>Force Password Reset:</b> Mandate password rotation across all corporate portals and SSO integrations.<br/>"
                       f"&bull; <b>Endpoint Investigation:</b> Isolate and inspect machines associated with stealer-log detections for active malware.", table_cell)],
            [Paragraph("<b>Priority 2: Authentication Hardening (Within 7 Days)</b>", table_cell_bold)],
            [Paragraph("&bull; <b>Phishing-Resistant MFA:</b> Upgrade authentication to FIDO2 WebAuthn or Authenticator App push notifications.<br/>"
                       "&bull; <b>Conditional Access:</b> Enforce IP reputation filtering, device compliance checks, and impossible travel velocity blocks.", table_cell)],
            [Paragraph("<b>Priority 3: Continuous Governance (Ongoing)</b>", table_cell_bold)],
            [Paragraph(f"&bull; <b>Automated Surveillance:</b> Maintain continuous surveillance on <b>{target_scope}</b> to detect newly syndicated exposures.<br/>"
                       "&bull; <b>Password Manager Policy:</b> Require enterprise password managers to eliminate credential reuse across services.", table_cell)],
        ]
    else:
        story.append(Paragraph("Verification of Completed Remediation & Ongoing Controls", h2))
        actions = [
            [Paragraph("<b>Remediation Verification Status: Marked Remediated in BreachGuard</b>", table_cell_bold)],
            [Paragraph(
                f"The exposure findings for <b>{target_scope}</b> currently hold the status of <b>Marked Remediated in BreachGuard</b>. "
                f"Organizations should independently verify password rotation, session revocation, and endpoint hygiene "
                f"to validate that defensive mitigations have been executed internally.",
                table_cell
            )],
            [Paragraph("<b>Recommended Defensive Hygiene (Ongoing)</b>", table_cell_bold)],
            [Paragraph(
                f"&bull; <b>Continuous Monitoring:</b> Keep automated monitoring enabled on <b>{target_scope}</b> to alert security teams immediately upon any new intelligence findings.<br/>"
                "&bull; <b>Phishing-Resistant MFA:</b> Ensure all privileged accounts enforce hardware-backed or authenticator app MFA.<br/>"
                "&bull; <b>Credential Hygiene:</b> Conduct periodic dark web intelligence reviews to assist with security governance and internal control monitoring.",
                table_cell
            )],
        ]

    action_table = Table(actions, colWidths=[540])
    action_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#FEF2F2') if open_count > 0 else colors.HexColor('#F0FDF4')),
        ('BACKGROUND', (0,2), (0,2), colors.HexColor('#FFFBEB') if open_count > 0 else colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (0,4), (0,4), colors.HexColor('#F0FDF4') if open_count > 0 else colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(action_table)
    story.append(Spacer(1, 7))

    # --- Intelligence Methodology & Legal Disclaimer (Complete, Defensible Phrasing) ---
    methodology_text = (
        "<b>Intelligence Methodology & Scope:</b> BreachGuard aggregates, normalizes, and correlates external telemetry "
        "from third-party threat-intelligence providers, public breach repositories, and supported intelligence sources. "
        "BreachGuard does not execute offensive intrusions or penetrate third-party systems. "
        "Findings represent the presence of matching identity or credential artifacts within monitored intelligence datasets "
        "and should be independently validated by the affected organization."
    )
    story.append(Paragraph(methodology_text, small))

    # Build the document with two-pass canvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return filepath
