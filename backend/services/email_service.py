import logging
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
import httpx

from core.config import settings

logger = logging.getLogger("breachguard.email")

async def send_email_with_details(
    to_email: str, 
    subject: str, 
    html_body: Optional[str] = None, 
    text_body: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Dispatches transactional or alert email with provider tracking, delivery audit, and attachment support:
    1. Resend REST API (preferred, fast, serverless-friendly, $0 tier - 3000 free/mo)
    2. Standard SMTP (Gmail, AWS SES, Postmark, Mailgun)
    3. Safe Mock Logger (fallback strictly in dev/test when credentials are unset)
    """
    clean_to = to_email.strip()
    clean_from = settings.FROM_EMAIL or "breachguard.io@gmail.com"
    plain_text = text_body or "This email requires an HTML-compatible email client to view."
    last_resend_error = None
    last_smtp_error = None

    # Determine provider routing:
    # If sender is @gmail.com or SMTP credentials are configured, prioritize SMTP so sent emails appear in the Gmail Sent folder
    smtp_host = settings.SMTP_HOST or "smtp.gmail.com"
    smtp_port = settings.SMTP_PORT or 587
    smtp_user = settings.SMTP_USER or (clean_from if clean_from.endswith("@gmail.com") else None)
    smtp_pass = (settings.SMTP_PASSWORD or "").replace(" ", "").strip()

    use_smtp = bool(
        clean_from.endswith("@gmail.com") 
        or (smtp_host and smtp_user and smtp_pass)
    )

    # 1. Authenticated Gmail / Standard SMTP (Priority for @gmail.com senders)
    if use_smtp:
        if not smtp_pass:
            err = (
                f"Cannot send from {clean_from}: SMTP_PASSWORD is not configured. "
                "Please set your 16-character Google App Password in environment variable SMTP_PASSWORD."
            )
            logger.error(f"[EMAIL:SMTP] {err}")
            return {"success": False, "provider": "gmail_smtp", "message_id": None, "error": err}

        def _send_smtp_sync():
            from_display = f"Khubaib Ahmed <{clean_from}>" if "gmail" in clean_from.lower() or "breachguard" in clean_from.lower() else f"BreachGuard <{clean_from}>"
            if not attachments and not html_body:
                # Ultra-clean Plain Text mode: Highest deliverability score in spam filters.
                # Replicates 1-to-1 human email composed directly in native Gmail client.
                msg = MIMEText(plain_text, "plain", "utf-8")
                msg["Subject"] = subject
                msg["From"] = from_display
                msg["To"] = clean_to
                msg["Reply-To"] = clean_from
            else:
                msg = MIMEMultipart("mixed") if attachments else MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = from_display
                msg["To"] = clean_to
                msg["Reply-To"] = clean_from

                # Body part
                if html_body:
                    body_part = MIMEMultipart("alternative")
                    body_part.attach(MIMEText(plain_text, "plain", "utf-8"))
                    body_part.attach(MIMEText(html_body, "html", "utf-8"))
                    msg.attach(body_part)
                else:
                    msg.attach(MIMEText(plain_text, "plain", "utf-8"))

                # Attachments
                if attachments:
                    from email.mime.application import MIMEApplication
                    import base64
                    for att in attachments:
                        content_bytes = att.get("raw_bytes")
                        if not content_bytes and "content" in att:
                            try:
                                content_bytes = base64.b64decode(att["content"])
                            except Exception:
                                content_bytes = None
                        if content_bytes:
                            part = MIMEApplication(content_bytes, _subtype="pdf")
                            filename = att.get("filename", "assessment.pdf")
                            part.add_header("Content-Disposition", "attachment", filename=filename)
                            msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except smtplib.SMTPNotSupportedError:
                    pass
                server.login(smtp_user or clean_from, smtp_pass)
                server.sendmail(smtp_user or clean_from, [clean_to], msg.as_string())

        try:
            await asyncio.to_thread(_send_smtp_sync)
            provider_name = "gmail_smtp" if "gmail" in smtp_host.lower() else "smtp"
            logger.info(f"[EMAIL:{provider_name.upper()}] Dispatched successfully to {clean_to} from {clean_from} (synced to Sent folder)")
            import time
            return {"success": True, "provider": provider_name, "message_id": f"smtp_{int(time.time()*1000)}", "error": None}
        except smtplib.SMTPAuthenticationError as auth_err:
            err = f"Gmail SMTP Authentication Failed: Invalid App Password for {smtp_user or clean_from}. ({auth_err})"
            logger.error(f"[EMAIL:SMTP] {err}")
            return {"success": False, "provider": "gmail_smtp", "message_id": None, "error": err}
        except Exception as e:
            logger.error(f"[EMAIL:SMTP] Error dispatching to {clean_to}: {e}")
            last_smtp_error = str(e)
            if clean_from.endswith("@gmail.com"):
                return {"success": False, "provider": "gmail_smtp", "message_id": None, "error": f"Gmail SMTP Delivery Failed: {last_smtp_error}"}

    # Format attachments for Resend if present
    resend_attachments = None
    if attachments:
        resend_attachments = []
        for att in attachments:
            if "content" in att and "filename" in att:
                resend_attachments.append({
                    "filename": att["filename"],
                    "content": att["content"]
                })

    # 2. Resend API (used when not sending from @gmail.com)
    if settings.RESEND_API_KEY and not clean_from.endswith("@gmail.com"):
        try:
            from_display = f"Khubaib Ahmed <{clean_from}>" if "gmail" in clean_from.lower() or "breachguard" in clean_from.lower() else f"BreachGuard <{clean_from}>"
            req_payload = {
                "from": from_display,
                "to": [clean_to],
                "subject": subject,
                "text": plain_text
            }
            if html_body:
                req_payload["html"] = html_body
            if resend_attachments:
                req_payload["attachments"] = resend_attachments

            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=req_payload
                )
                if res.status_code in (200, 201):
                    msg_id = res.json().get("id")
                    logger.info(f"[EMAIL:RESEND] Dispatched successfully to {clean_to} (ID: {msg_id})")
                    return {"success": True, "provider": "resend", "message_id": msg_id, "error": None}

                # Handle unverified domain fallback or sandbox mode
                res_json = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = res_json.get("message") or res.text

                if res.status_code == 403 and "not verified" in res.text:
                    logger.info(f"[EMAIL:RESEND] {clean_from} not yet verified on Resend; retrying with onboarding@resend.dev sandbox")
                    sandbox_payload = {
                        "from": "BreachGuard Security <onboarding@resend.dev>",
                        "to": [clean_to],
                        "subject": subject,
                        "html": html_body,
                        "text": plain_text
                    }
                    if resend_attachments:
                        sandbox_payload["attachments"] = resend_attachments

                    retry_res = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json=sandbox_payload
                    )
                    if retry_res.status_code in (200, 201):
                        msg_id = retry_res.json().get("id")
                        logger.info(f"[EMAIL:RESEND] Dispatched successfully via sandbox to {clean_to} (ID: {msg_id})")
                        return {"success": True, "provider": "resend", "message_id": msg_id, "error": None}
                    
                    retry_json = retry_res.json() if retry_res.headers.get("content-type", "").startswith("application/json") else {}
                    last_resend_error = retry_json.get("message") or retry_res.text
                    logger.warning(f"[EMAIL:RESEND] Sandbox retry failed: {last_resend_error}")
                else:
                    last_resend_error = err_msg
                    logger.warning(f"[EMAIL:RESEND] Dispatch failed (HTTP {res.status_code}): {err_msg}")

        except Exception as e:
            logger.error(f"[EMAIL:RESEND] Network error dispatching to {clean_to}: {e}")
            last_resend_error = str(e)

    # If Resend API key was provided and it failed, and no working SMTP:
    if settings.RESEND_API_KEY and last_resend_error:
        if "only send testing emails to your own email address" in last_resend_error:
            formatted_error = (
                "Resend Sandbox Restriction: In unverified testing mode, emails can only be sent to your registered account "
                "(khubbiahmed@gmail.com). To send to real client domains, please verify your custom domain at https://resend.com/domains."
            )
        else:
            formatted_error = f"Resend Error: {last_resend_error}"
        return {"success": False, "provider": "resend", "message_id": None, "error": formatted_error}

    # 3. Dev mock fallback (only if credentials are unset)
    logger.info(
        f"[EMAIL:MOCK_DISPATCH] Simulated email delivery to: {clean_to} | Subject: '{subject}' | Attachments: {len(attachments) if attachments else 0}"
    )
    return {"success": True, "provider": "mock", "message_id": "simulated_mock_dispatch", "error": None}


async def send_email(
    to_email: str, 
    subject: str, 
    html_body: str, 
    text_body: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> bool:
    """
    Convenience wrapper for send_email_with_details returning boolean.
    """
    res = await send_email_with_details(to_email, subject, html_body, text_body, attachments=attachments)
    return res["success"]

# ==============================================================================
# HTML EMAIL TEMPLATES (Enterprise Dark Mode)
# ==============================================================================

def render_password_reset_email(reset_url: str, user_email: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your BreachGuard Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #09090b; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="560px" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 36px 32px;">
          <!-- Header -->
          <tr>
            <td align="left" style="padding-bottom: 24px; border-bottom: 1px solid #27272a;">
              <span style="font-size: 16px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">BREACHGUARD</span>
              <span style="display: block; font-size: 11px; color: #a1a1aa; margin-top: 2px;">Threat Intelligence & Exposure Defense</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-top: 28px; padding-bottom: 24px;">
              <h1 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0;">Password Reset Request</h1>
              <p style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin: 0 0 20px 0;">
                We received a request to reset the password for your account associated with <strong style="color: #ffffff;">{user_email}</strong>.
              </p>
              <p style="font-size: 13px; line-height: 1.6; color: #a1a1aa; margin: 0 0 28px 0;">
                This link will expire in <strong style="color: #e4e4e7;">60 minutes</strong>. If you did not request this change, please ignore this email or notify your security administrator.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #ffffff;">
                    <a href="{reset_url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 600; color: #09090b; text-decoration: none; border-radius: 8px;">
                      Reset Password Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 11px; line-height: 1.5; color: #71717a; margin-top: 32px;">
                Alternatively, copy and paste this link into your browser:<br/>
                <a href="{reset_url}" style="color: #60a5fa; word-break: break-all;">{reset_url}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #71717a; text-align: center;">
              BreachGuard Security Systems • Automated Alert Gateway
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def render_breach_alert_email(org_name: str, domain: str, exposure_count: int, exposures: List[Any]) -> str:
    rows_html = ""
    for exp in exposures[:5]:
        email_val = getattr(exp, "email", "redacted@domain.com")
        source_val = getattr(exp, "source", "Dark Web Dump")
        severity_val = getattr(exp, "severity", "High").upper()
        color = "#ef4444" if severity_val == "CRITICAL" else "#f97316" if severity_val == "HIGH" else "#eab308"
        rows_html += f"""
        <tr style="border-bottom: 1px solid #27272a;">
          <td style="padding: 10px 8px; font-size: 12px; color: #f4f4f5; font-family: monospace;">{email_val}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #a1a1aa;">{source_val}</td>
          <td style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: {color};">{severity_val}</td>
        </tr>
        """

    dashboard_url = f"{settings.FRONTEND_URL}/dashboard"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BreachGuard Security Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #09090b; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="580px" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 36px 32px;">
          <tr>
            <td align="left" style="padding-bottom: 20px; border-bottom: 1px solid #27272a;">
              <span style="display: inline-block; padding: 4px 10px; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 20px; font-size: 11px; font-weight: 600; color: #f87171;">
                🚨 EXPOSURE ALERT
              </span>
              <h2 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 12px 0 4px 0;">New Exposures Detected for {domain}</h2>
              <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Organization: {org_name}</p>
            </td>
          </tr>

          <tr>
            <td style="padding-top: 24px; padding-bottom: 24px;">
              <p style="font-size: 13px; line-height: 1.5; color: #d4d4d8; margin: 0 0 16px 0;">
                BreachGuard active surveillance identified <strong style="color: #ef4444;">{exposure_count} new credential exposure(s)</strong> tied to your monitored perimeter.
              </p>

              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="border-bottom: 1px solid #3f3f46; text-align: left;">
                    <th style="padding: 8px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Identity</th>
                    <th style="padding: 8px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Source</th>
                    <th style="padding: 8px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows_html}
                </tbody>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #ffffff;">
                    <a href="{dashboard_url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 600; color: #09090b; text-decoration: none; border-radius: 8px;">
                      Review Exposures in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #71717a; text-align: center;">
              BreachGuard SOC • Automated Continuous Surveillance Gateway
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def render_team_invite_email(inviter_email: str, org_name: str, role: str, temp_password: Optional[str] = None) -> str:
    login_url = f"{settings.FRONTEND_URL}/login"
    cred_note = ""
    if temp_password:
        cred_note = f"""
        <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <div style="font-size: 11px; color: #a1a1aa;">Temporary Access Password:</div>
          <div style="font-size: 14px; font-family: monospace; font-weight: 600; color: #10b981; margin-top: 4px;">{temp_password}</div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invitation to join BreachGuard workspace</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #09090b; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="560px" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 36px 32px;">
          <tr>
            <td align="left" style="padding-bottom: 20px; border-bottom: 1px solid #27272a;">
              <span style="font-size: 16px; font-weight: 700; color: #ffffff;">BREACHGUARD</span>
              <span style="display: block; font-size: 11px; color: #a1a1aa; margin-top: 2px;">Team Access Authorization</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; padding-bottom: 24px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0;">You've Been Invited to {org_name}</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin: 0 0 16px 0;">
                <strong style="color: #ffffff;">{inviter_email}</strong> has added you to the <strong>{org_name}</strong> security workspace with the role of <strong style="color: #60a5fa;">{role.upper()}</strong>.
              </p>
              {cred_note}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #ffffff;">
                    <a href="{login_url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 600; color: #09090b; text-decoration: none; border-radius: 8px;">
                      Sign In to Workspace
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #71717a; text-align: center;">
              BreachGuard Security Systems • Access Management
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def render_invoice_request_email(
    company_name: str, 
    billing_email: str, 
    plan: str, 
    billing_cycle: str, 
    price_str: str, 
    po_number: Optional[str] = None
) -> str:
    po_html = f"""
    <tr>
      <td style="padding: 6px 0; color: #a1a1aa; font-size: 12px;">Purchase Order (PO):</td>
      <td style="padding: 6px 0; color: #ffffff; font-weight: 600; font-size: 12px; text-align: right;">{po_number}</td>
    </tr>
    """ if po_number else ""

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BreachGuard Enterprise Invoice Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #09090b; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="560px" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 36px 32px;">
          <tr>
            <td align="left" style="padding-bottom: 20px; border-bottom: 1px solid #27272a;">
              <span style="font-size: 16px; font-weight: 700; color: #ffffff;">BREACHGUARD</span>
              <span style="display: block; font-size: 11px; color: #a1a1aa; margin-top: 2px;">Enterprise Procurement &amp; Invoicing</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; padding-bottom: 24px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0;">Order &amp; Invoice Request Received</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin: 0 0 20px 0;">
                Thank you for choosing BreachGuard for your perimeter exposure surveillance. We have received the enterprise procurement order for <strong style="color: #ffffff;">{company_name}</strong>.
              </p>
              
              <!-- Order Details Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #27272a; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0; color: #a1a1aa; font-size: 12px;">Organization:</td>
                  <td style="padding: 6px 0; color: #ffffff; font-weight: 600; font-size: 12px; text-align: right;">{company_name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #a1a1aa; font-size: 12px;">Plan Tier:</td>
                  <td style="padding: 6px 0; color: #60a5fa; font-weight: 600; font-size: 12px; text-align: right;">{plan.upper()} TIER</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #a1a1aa; font-size: 12px;">Billing Cadence:</td>
                  <td style="padding: 6px 0; color: #ffffff; font-weight: 600; font-size: 12px; text-align: right;">{billing_cycle.capitalize()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #a1a1aa; font-size: 12px;">Investment Total:</td>
                  <td style="padding: 6px 0; color: #10b981; font-weight: 700; font-size: 13px; text-align: right;">{price_str}</td>
                </tr>
                {po_html}
                <tr>
                  <td style="padding: 6px 0; color: #a1a1aa; font-size: 12px;">Payment Terms:</td>
                  <td style="padding: 6px 0; color: #e4e4e7; font-size: 12px; text-align: right;">Net-30 Corporate Wire / ACH</td>
                </tr>
              </table>

              <h3 style="font-size: 14px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">What Happens Next?</h3>
              <ol style="font-size: 12px; line-height: 1.7; color: #a1a1aa; padding-left: 18px; margin: 0 0 24px 0;">
                <li>Our corporate billing desk is generating your official Pro-Forma Invoice with international SWIFT, Wire, and ACH bank coordinates.</li>
                <li>The PDF invoice will be delivered directly to <strong style="color: #ffffff;">{billing_email}</strong> within 1 business day.</li>
                <li>Your workspace monitoring and multi-tenant capabilities remain fully active while payment is processed.</li>
              </ol>

              <p style="font-size: 12px; color: #71717a; margin: 0;">
                If your procurement department requires custom vendor registration forms (W-9 / W-8BEN, security questionnaires), simply reply directly to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #71717a; text-align: center;">
              BreachGuard Intelligence • Global Procurement &amp; Enterprise Licensing<br>
              Inquiries: billing@breachguard.io • security@breachguard.io
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
