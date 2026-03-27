from datetime import datetime
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import logging

logger = logging.getLogger(__name__)


async def send_anomaly_alert(anomaly_doc: dict, account_doc: dict, user_doc: dict, db):
    """
    Full alert dispatch for a detected anomaly.
    Sends: in-app (always) + SMS (if configured) + email simulation
    """
    from backend.config import settings

    user_id = str(user_doc["_id"])
    prefs = user_doc.get("notification_prefs", {"email": True, "sms": True, "in_app": True})
    threshold = user_doc.get("alert_threshold_percent", 25)
    deviation = anomaly_doc.get("deviation_percent", 0)

    # Only alert if deviation exceeds user's threshold
    if deviation < threshold:
        logger.info(f"Anomaly deviation {deviation}% below threshold {threshold}%, skipping alert")
        return {"skipped": True, "reason": "below_threshold"}

    service = anomaly_doc.get("service", "Unknown Service")
    account_name = account_doc.get("account_name", "Unknown Account")
    provider = account_doc.get("provider", "aws").upper()
    actual = anomaly_doc.get("actual_cost", 0)
    expected = anomaly_doc.get("expected_cost", 0)
    severity = anomaly_doc.get("severity", "medium").upper()
    anomaly_date = anomaly_doc.get("anomaly_date", "")
    detection_method = anomaly_doc.get("detection_method", "combined").replace("_", " ").title()

    # Format date nicely
    if hasattr(anomaly_date, 'strftime'):
        date_str = anomaly_date.strftime("%b %d, %Y")
    else:
        date_str = str(anomaly_date)[:10]

    # Severity emoji
    severity_emoji = {"LOW": "🟡", "MEDIUM": "🟠", "HIGH": "🔴", "CRITICAL": "🚨"}.get(severity, "⚠️")

    # Budget context
    monthly_budget = account_doc.get("monthly_budget", 5000)
    budget_note = ""
    if actual > 0 and monthly_budget > 0:
        daily_budget = monthly_budget / 30
        budget_pct = (actual / daily_budget) * 100
        if budget_pct > 100:
            budget_note = f" This single day exceeds your daily budget of ${daily_budget:.0f}."

    # --- IN-APP ALERT (always stored) ---
    in_app_message = (
        f"{severity_emoji} [{severity}] {service} cost anomaly detected on {account_name} ({provider}). "
        f"Actual: ${actual:.2f} vs Expected: ${expected:.2f} "
        f"(+{deviation:.0f}% deviation) on {date_str}.{budget_note}"
    )

    if prefs.get("in_app", True):
        await db.alerts.insert_one({
            "user_id": user_id,
            "anomaly_id": str(anomaly_doc.get("_id", "")),
            "account_id": str(account_doc.get("_id", "")),
            "channel": "in_app",
            "status": "sent",
            "message": in_app_message,
            "sent_at": datetime.utcnow(),
            "read": False
        })

        # Broadcast via WebSocket
        try:
            from backend.services.ws_manager import broadcast_alert
            await broadcast_alert(str(user_id), {
                "message": in_app_message,
                "severity": severity,
                "service": service,
                "account_name": account_name,
                "deviation_percent": deviation,
                "actual_cost": actual,
                "id": str(anomaly_doc.get("_id", ""))
            })
        except Exception:
            pass  # WebSocket broadcast is best-effort

    # --- SMS VIA TWILIO ---
    if prefs.get("sms", True) and user_doc.get("phone_number"):
        sms_message = (
            f"CostPilot Alert {severity_emoji}\n"
            f"Account: {account_name} ({provider})\n"
            f"Service: {service}\n"
            f"Date: {date_str}\n"
            f"Cost: ${actual:.2f} (expected ${expected:.2f})\n"
            f"Deviation: +{deviation:.0f}%\n"
            f"Severity: {severity}\n"
            f"Detected by: {detection_method}\n"
            f"{budget_note}\n"
            f"Login to CostPilot to review and resolve."
        )

        sms_status = "failed"
        sms_error = None

        twilio_sid = settings.twilio_account_sid
        twilio_token = settings.twilio_auth_token
        twilio_from = settings.twilio_from_number

        if twilio_sid and twilio_token and twilio_from and twilio_sid.strip():
            try:
                client = Client(twilio_sid, twilio_token)
                message = client.messages.create(
                    body=sms_message,
                    from_=twilio_from,
                    to=user_doc["phone_number"]
                )
                sms_status = "sent"
                logger.info(f"SMS sent successfully: SID {message.sid}")
            except TwilioRestException as e:
                sms_error = str(e)
                sms_status = "failed"
                logger.error(f"Twilio error: {e}")
            except Exception as e:
                sms_error = str(e)
                sms_status = "failed"
                logger.error(f"SMS send error: {e}")
        else:
            logger.warning(
                "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env"
            )
            sms_status = "failed"
            sms_error = "Twilio credentials not configured"

        await db.alerts.insert_one({
            "user_id": user_id,
            "anomaly_id": str(anomaly_doc.get("_id", "")),
            "account_id": str(account_doc.get("_id", "")),
            "channel": "sms",
            "status": sms_status,
            "message": sms_message,
            "error": sms_error,
            "sent_at": datetime.utcnow(),
            "read": False
        })

    # --- EMAIL SIMULATION ---
    if prefs.get("email", True):
        email_body = f"""
╔══════════════════════════════════════════════════╗
║          COSTPILOT ANOMALY ALERT                 ║
╚══════════════════════════════════════════════════╝

{severity_emoji} Severity: {severity}
Account:   {account_name} ({provider})
Service:   {service}
Date:      {date_str}

Cost Details:
  Expected:  ${expected:.4f}
  Actual:    ${actual:.4f}
  Deviation: +{deviation:.1f}%

Detection:   {detection_method}
{budget_note}

Action Required:
  → Log in to CostPilot to acknowledge this anomaly
  → Review resource usage for {service}
  → Check for unauthorized deployments or scaling events

════════════════════════════════════════════════════
CostPilot Cloud Cost Intelligence
        """

        print(
            f"\n[EMAIL SIMULATION] To: {user_doc.get('email')}\n"
            f"Subject: {severity_emoji} CostPilot: {service} anomaly detected (+{deviation:.0f}%)\n"
            f"{email_body}\n"
        )

        await db.alerts.insert_one({
            "user_id": user_id,
            "anomaly_id": str(anomaly_doc.get("_id", "")),
            "account_id": str(account_doc.get("_id", "")),
            "channel": "email",
            "status": "sent",
            "message": f"[EMAIL] {in_app_message}",
            "sent_at": datetime.utcnow(),
            "read": False
        })

    return {
        "in_app": prefs.get("in_app", True),
        "sms": "sent" if prefs.get("sms") and user_doc.get("phone_number") else "skipped",
        "email": "simulated" if prefs.get("email") else "skipped"
    }


async def send_test_alert(user_doc: dict, db):
    """Send a test alert across all configured channels."""

    test_anomaly = {
        "_id": "test_alert_000",
        "service": "EC2",
        "anomaly_date": datetime.utcnow(),
        "expected_cost": 120.00,
        "actual_cost": 487.50,
        "deviation_percent": 306.25,
        "severity": "critical",
        "detection_method": "combined"
    }
    test_account = {
        "_id": "test_account_000",
        "account_name": "Test Account",
        "provider": "aws",
        "monthly_budget": 5000
    }

    # Force all channels enabled and threshold 0 for test alerts
    user_copy = {
        **user_doc,
        "alert_threshold_percent": 0,
        "notification_prefs": {"email": True, "sms": True, "in_app": True}
    }

    return await send_anomaly_alert(test_anomaly, test_account, user_copy, db)


async def evaluate_rules_for_anomaly(anomaly_doc, db):
    acc = await db.cloud_accounts.find_one({"_id": anomaly_doc["account_id"]})
    user = await db.users.find_one({"_id": anomaly_doc["user_id"]})

    if acc and user:
        await send_anomaly_alert(anomaly_doc, acc, user, db)
