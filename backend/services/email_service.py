import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
import logging
from config import settings

logger = logging.getLogger(__name__)

def build_anomaly_email_html(anomaly: dict, account: dict, user: dict) -> str:
    """Build a rich HTML email that looks like a real SaaS alert email."""
    
    service = anomaly.get("service", "Unknown")
    account_name = account.get("account_name", "Unknown")
    provider = account.get("provider", "aws").upper()
    actual = anomaly.get("actual_cost", 0)
    expected = anomaly.get("expected_cost", 0)
    deviation = anomaly.get("deviation_percent", 0)
    severity = anomaly.get("severity", "medium").lower()
    date_str = anomaly.get("anomaly_date", datetime.utcnow()).strftime("%d %B %Y")
    user_name = user.get("full_name", "there")
    
    # Convert to INR estimate for email (83.5)
    actual_inr = actual * 83.5
    expected_inr = expected * 83.5
    
    severity_color = {
        "low": "#4AFFD4", "medium": "#FFB84A",
        "high": "#FF8A4A", "critical": "#FF4A6A"
    }.get(severity, "#FFB84A")
    
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#111114;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    
    <!-- Header -->
    <div style="background:#111114;padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <span style="color:#B6FF4A;font-size:20px;font-weight:700;letter-spacing:-0.5px;">⚡ CostPilot</span>
      </div>
      <p style="color:#8A8A9A;margin:0;font-size:13px;">Cloud Cost Intelligence Platform</p>
    </div>
    
    <!-- Alert Banner -->
    <div style="background:rgba(255,74,106,0.08);border-left:4px solid {severity_color};padding:24px 40px;">
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <span style="color:{severity_color};font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:1px;">🚨 {severity} Anomaly Detected</span>
      </div>
      <p style="color:#F5F5F7;font-size:24px;font-weight:700;margin:0 0 4px;">{service} on {account_name}</p>
      <p style="color:#8A8A9A;margin:0;font-size:14px;">{date_str} · {provider}</p>
    </div>
    
    <!-- Cost Breakdown -->
    <div style="padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <p style="color:#8A8A9A;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 20px;">Cost Breakdown</p>
      
      <div style="margin-bottom:24px;">
        <div style="background:#18181D;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">
          <p style="color:#8A8A9A;font-size:12px;margin:0 0 8px;">Expected Cost</p>
          <p style="color:#F5F5F7;font-size:22px;font-weight:700;font-family:monospace;margin:0;">₹{expected_inr:,.2f}</p>
          <p style="color:#8A8A9A;font-size:11px;margin:4px 0 0;">${expected:.4f} USD</p>
        </div>
        <div style="background:rgba(255,74,106,0.08);border-radius:12px;padding:20px;border:1px solid rgba(255,74,106,0.2);">
          <p style="color:#8A8A9A;font-size:12px;margin:0 0 8px;">Actual Cost</p>
          <p style="color:#FF4A6A;font-size:22px;font-weight:700;font-family:monospace;margin:0;">₹{actual_inr:,.2f}</p>
          <p style="color:#8A8A9A;font-size:11px;margin:4px 0 0;">${actual:.4f} USD</p>
        </div>
      </div>
      
      <div style="background:rgba(182,255,74,0.06);border-radius:12px;padding:16px 20px;border:1px solid rgba(182,255,74,0.15);text-align:center;">
        <span style="color:#B6FF4A;font-size:28px;font-weight:700;font-family:monospace;">+{deviation:.1f}%</span>
        <span style="color:#8A8A9A;font-size:14px;margin-left:12px;">above baseline</span>
      </div>
    </div>
    
    <!-- Actions -->
    <div style="padding:32px 40px;text-align:center;">
      <p style="color:#F5F5F7;margin:0 0 20px;font-size:15px;">Hi {user_name}, review this anomaly in your dashboard.</p>
      <a href="http://localhost:5173/anomalies" 
         style="background:#B6FF4A;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
        Review Anomaly →
      </a>
      <p style="color:#4A4A5A;font-size:12px;margin:24px 0 0;">
        You're receiving this because anomaly alerts are enabled in your CostPilot settings.<br>
        <a href="http://localhost:5173/settings" style="color:#8A8A9A;">Manage notification preferences</a>
      </p>
    </div>
    
  </div>
</body>
</html>
"""

async def send_email_alert(to_email: str, subject: str, html_body: str, text_body: str = "") -> dict:
    """Send real email via Gmail SMTP. Requires App Password in .env"""
    
    smtp_user = settings.smtp_user
    smtp_pass = settings.smtp_pass # Refers to the new SMTP_PASSWORD key mapped to smtp_pass in config
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    from_name = settings.smtp_from_name or "CostPilot"
    
    if not smtp_user or not smtp_pass or smtp_user == "your-gmail@gmail.com":
        logger.warning("[EMAIL] SMTP not configured. Printing to console instead.")
        print(f"\n{'='*60}")
        print(f"[EMAIL SIMULATION] To: {to_email}")
        print(f"Subject: {subject}")
        print(f"{'='*60}")
        print(text_body if text_body else "HTML Body provided")
        print(f"{'='*60}\n")
        return {"status": "simulated", "reason": "SMTP not configured"}
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{smtp_user}>"
        msg["To"] = to_email
        
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        
        logger.info(f"[EMAIL] Sent successfully to {to_email}")
        return {"status": "sent"}
    
    except smtplib.SMTPAuthenticationError:
        logger.error("[EMAIL] SMTP Authentication failed. Check your App Password.")
        return {"status": "failed", "error": "Authentication failed — check App Password"}
    except Exception as e:
        logger.error(f"[EMAIL] Failed: {e}")
        return {"status": "failed", "error": str(e)}
