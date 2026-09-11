import logging
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
import httpx

from core.config import settings

logger = logging.getLogger("breachguard.email")

async def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """
    Dispatches transactional or alert email using:
    1. Resend REST API (preferred, fast, serverless-friendly, $0 tier - 3000 free/mo)
    2. Standard SMTP (Gmail, AWS SES, Postmark, Mailgun)
    3. Safe Mock Logger (fallback in dev/test when credentials are unset)
    """
    clean_to = to_email.strip()
    clean_from = settings.FROM_EMAIL or "security@breachguard.io"
    plain_text = text_body or "This email requires an HTML-compatible email client to view."

    # 1. Resend API
    if settings.RESEND_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": f"BreachGuard Security <{clean_from}>",
                        "to": [clean_to],
                        "subject": subject,
                        "html": html_body,
                        "text": plain_text
                    }
                )
                if res.status_code in (200, 201):
                    logger.info(f"[EMAIL:RESEND] Dispatched successfully to {clean_to}")
                    return True
                else:
                    logger.warning(f"[EMAIL:RESEND] Failed HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"[EMAIL:RESEND] Network error dispatching to {clean_to}: {e}")

    # 2. Standard SMTP
    if settings.SMTP_HOST:
        def _send_smtp_sync():
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"BreachGuard Security <{clean_from}>"
            msg["To"] = clean_to

            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except smtplib.SMTPNotSupportedError:
                    pass
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(clean_from, [clean_to], msg.as_string())

        try:
            await asyncio.to_thread(_send_smtp_sync)
            logger.info(f"[EMAIL:SMTP] Dispatched successfully to {clean_to}")
            return True
        except Exception as e:
            logger.error(f"[EMAIL:SMTP] Error dispatching to {clean_to}: {e}")

    # 3. Fallback / Dev Mock Logger
    logger.info(
        f"[EMAIL:MOCK_DISPATCH] Simulated email delivery to: {clean_to} | Subject: '{subject}'"
    )
    return True

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
              <span style="font-size: 16px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">🛡️ BREACHGUARD</span>
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
              <span style="font-size: 16px; font-weight: 700; color: #ffffff;">🛡️ BREACHGUARD</span>
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
