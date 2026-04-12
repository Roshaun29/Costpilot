from datetime import datetime, date
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import logging
from .email_service import send_email_alert, build_anomaly_email_html
from models.alert import Alert
from models.anomaly import AnomalyResult
from models.cloud_account import CloudAccount
from models.user import User
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

async def send_anomaly_alert(anomaly: AnomalyResult, account: CloudAccount, user: User, db: AsyncSession):
    """
    Full alert dispatch for a detected anomaly.
    Sends: in-app (always) + SMS (if configured) + Professional HTML email (via SMTP)
    """
    from config import settings

    from sqlalchemy import select, and_
    
    # Check if alert already sent for this anomaly + channel (in_app)
    existing = await db.execute(
        select(Alert).where(
            and_(
                Alert.anomaly_id == str(anomaly.id),
                Alert.user_id == str(user.id),
                Alert.channel == "in_app"
            )
        )
    )
    if existing.scalar_one_or_none():
        logger.info(f"Alert already sent for anomaly {anomaly.id}, skipping duplicates")
        return {"skipped": True, "reason": "Already sent"}

    prefs = {
        "email": user.notif_email,
        "sms": user.notif_sms,
        "in_app": user.notif_in_app
    }
    threshold = user.alert_threshold_percent
    deviation = anomaly.deviation_percent

    # Only alert if deviation exceeds user's threshold
    if deviation < threshold:
        logger.info(f"Anomaly deviation {deviation}% below threshold {threshold}%, skipping alert")
        return {"skipped": True, "reason": "below_threshold"}

    service = anomaly.service
    account_name = account.account_name
    provider = account.provider.upper()
    actual = anomaly.actual_cost
    expected = anomaly.expected_cost
    severity = anomaly.severity.lower()
    anomaly_date = anomaly.anomaly_date
    
    date_str = anomaly_date.strftime("%b %d, %Y") if hasattr(anomaly_date, 'strftime') else str(anomaly_date)[:10]
    severity_emoji = {"low": "🟡", "medium": "🟠", "high": "🔴", "critical": "🚨"}.get(severity, "⚠️")

    # Budget context
    monthly_budget = account.monthly_budget
    budget_note = ""
    if actual > 0 and monthly_budget > 0:
        daily_budget = monthly_budget / 30
        budget_pct = (actual / daily_budget) * 100
        if budget_pct > 100:
            budget_note = f" This single day exceeds your daily budget of ₹{daily_budget:.0f}."

    # --- IN-APP ALERT ---
    in_app_message = (
        f"{severity_emoji} [{severity.upper()}] {service} cost anomaly detected on {account_name} ({provider}). "
        f"Actual: ₹{actual:.2f} vs Expected: ₹{expected:.2f} "
        f"(+{deviation:.0f}% deviation) on {date_str}.{budget_note}"
    )

    if prefs.get("in_app", True):
        new_alert = Alert(
            user_id=user.id,
            anomaly_id=anomaly.id,
            account_id=account.id,
            channel="in_app",
            status="sent",
            message=in_app_message,
            sent_at=datetime.utcnow(),
            is_read=False
        )
        db.add(new_alert)
        
        # Broadcast via WebSocket
        try:
            from services.ws_manager import broadcast_alert
            await broadcast_alert(user.id, {
                "message": in_app_message,
                "severity": severity,
                "service": service,
                "account_name": account_name,
                "deviation_percent": deviation,
                "actual_cost": actual,
                "id": anomaly.id
            })
        except Exception:
            pass 

    # --- SMS VIA TWILIO ---
    sms_status = "skipped"
    if prefs.get("sms", True) and user.phone_number:
        sms_message = (
            f"CostPilot Alert {severity_emoji}\n"
            f"Account: {account_name} ({provider})\n"
            f"Service: {service}\n"
            f"Date: {date_str}\n"
            f"Cost: ₹{actual:.2f} (expected ₹{expected:.2f})\n"
            f"Deviation: +{deviation:.0f}%\n"
            f"Severity: {severity.upper()}\n"
            f"{budget_note}\n"
            f"Login to review."
        )

        twilio_sid = settings.twilio_account_sid
        twilio_token = settings.twilio_auth_token
        twilio_from = settings.twilio_from_number

        if twilio_sid and twilio_token and twilio_from and twilio_sid.strip():
            try:
                client = Client(twilio_sid, twilio_token)
                client.messages.create(body=sms_message, from_=twilio_from, to=user.phone_number)
                sms_status = "sent"
            except Exception as e:
                logger.error(f"SMS send error: {e}")
                sms_status = "failed"
        else:
            sms_status = "unconfigured"

        db.add(Alert(
            user_id=user.id,
            anomaly_id=anomaly.id,
            account_id=account.id,
            channel="sms",
            status=sms_status,
            message=sms_message,
            sent_at=datetime.utcnow(),
            is_read=False
        ))

    # --- EMAIL ---
    email_status = "skipped"
    if prefs.get("email", True):
        subject = f"🚨 [{severity.upper()}] {service} anomaly on {account_name} (+{deviation:.0f}%)"
        # Dummy dicts for legacy email builder compatibility if needed, 
        # but better to update builder too. For now using models directly.
        html_body = build_anomaly_email_html(anomaly, account, user)
        email_result = await send_email_alert(user.email, subject, html_body, in_app_message)
        email_status = email_result["status"]

        db.add(Alert(
            user_id=user.id,
            anomaly_id=anomaly.id,
            account_id=account.id,
            channel="email",
            status=email_status,
            message=f"[EMAIL] {in_app_message}",
            sent_at=datetime.utcnow(),
            is_read=False
        ))

    await db.commit()
    return {"in_app": True, "sms": sms_status, "email": email_status}

async def send_test_alert(user: User, db: AsyncSession):
    """Send a test alert across all configured channels."""
    test_anomaly = AnomalyResult(
        id="test_001",
        service="EC2",
        anomaly_date=date.today(),
        expected_cost=120.00,
        actual_cost=487.50,
        deviation_percent=306.25,
        severity="critical"
    )
    test_account = CloudAccount(
        id="test_acc_001",
        account_name="Test Account",
        provider="aws",
        monthly_budget=5000
    )
    # Temporary mock settings for test
    user.alert_threshold_percent = 0
    return await send_anomaly_alert(test_anomaly, test_account, user, db)
