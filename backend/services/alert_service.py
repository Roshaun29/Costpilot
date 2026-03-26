from datetime import datetime
from backend.utils.logger import logger
import os

async def send_anomaly_alert(anomaly_doc, account_doc, user_doc, db):
    uid = user_doc["_id"]
    prefs = user_doc.get("notification_prefs", {})
    threshold = user_doc.get("alert_threshold_percent", 25)
    
    dev_pct = anomaly_doc.get("deviation_percent", 0)
    if dev_pct < threshold:
        logger.info(f"Anomaly deviation ({dev_pct}%) below threshold ({threshold}%). Skipping alerts.")
        return
        
    message = f"🚨 CostPilot: {anomaly_doc['service']} cost spiked {dev_pct:.0f}% on {account_doc['account_name']}. Actual: ${anomaly_doc['actual_cost']:.2f} vs Expected: ${anomaly_doc['expected_cost']:.2f} ({anomaly_doc['severity']} severity)"
    
    await db.alerts.insert_one({
        "user_id": uid,
        "anomaly_id": anomaly_doc["_id"],
        "account_id": account_doc["_id"],
        "channel": "in_app",
        "status": "sent",
        "message": message,
        "sent_at": datetime.utcnow(),
        "read": False
    })
    
    if prefs.get("sms") and user_doc.get("phone_number"):
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")
        
        if twilio_sid and twilio_token and twilio_from:
            try:
                from twilio.rest import Client
                client = Client(twilio_sid, twilio_token)
                client.messages.create(
                    body=message,
                    from_=twilio_from,
                    to=user_doc["phone_number"]
                )
                await db.alerts.insert_one({
                    "user_id": uid, "anomaly_id": anomaly_doc["_id"], "account_id": account_doc["_id"],
                    "channel": "sms", "status": "sent", "message": message, "sent_at": datetime.utcnow(), "read": False
                })
            except Exception as e:
                logger.error(f"Twilio SMS failed: {e}")
                await db.alerts.insert_one({
                    "user_id": uid, "anomaly_id": anomaly_doc["_id"], "account_id": account_doc["_id"],
                    "channel": "sms", "status": "failed", "message": message, "sent_at": datetime.utcnow(), "read": False
                })
        else:
            logger.warning("Twilio not configured, skipping SMS")
            await db.alerts.insert_one({
                "user_id": uid, "anomaly_id": anomaly_doc["_id"], "account_id": account_doc["_id"],
                "channel": "sms", "status": "failed", "message": "Twilio unconfigured", "sent_at": datetime.utcnow(), "read": False
            })
            
    if prefs.get("email"):
        print(f"\n--- EMAIL DISPATCH ---")
        print(f"To: {user_doc.get('email')}")
        print(f"Subject: Critical Cost Anomaly Detected")
        print(f"Body: \n{message}")
        print(f"----------------------\n")
        await db.alerts.insert_one({
            "user_id": uid, "anomaly_id": anomaly_doc["_id"], "account_id": account_doc["_id"],
            "channel": "email", "status": "sent", "message": message, "sent_at": datetime.utcnow(), "read": False
        })
        
async def evaluate_rules_for_anomaly(anomaly_doc, db):
    acc = await db.cloud_accounts.find_one({"_id": anomaly_doc["account_id"]})
    user = await db.users.find_one({"_id": anomaly_doc["user_id"]})
    
    if acc and user:
        await send_anomaly_alert(anomaly_doc, acc, user, db)
