import asyncio
import os
import sys
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

# Need to append Cwd to path
sys.path.append(os.getcwd())
load_dotenv(os.path.join("backend", ".env"))

from backend.db.mongodb import connect_to_mongo, get_db

async def run():
    print("Connecting to Mongo...")
    await connect_to_mongo()
    db = get_db()
    
    for email in ["final@example.com", "finish@example.com"]:
        user = await db.users.find_one({"email": email})
        if user:
            # 1. Update user
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "phone_number": "+919385478140",
                        "notification_prefs.sms": True,
                        "notification_prefs.email": True,
                        "notification_prefs.in_app": True
                    }
                }
            )
            print(f"User {email} updated.")
            
            # 2. Get account
            account = await db.cloud_accounts.find_one({"user_id": user["_id"]})
            if account:
                # 3. Force Anomaly
                doc = {
                    "account_id": account["_id"],
                    "user_id": user["_id"],
                    "detected_at": datetime.utcnow(),
                    "service": "EC2",
                    "anomaly_date": datetime.utcnow(),
                    "expected_cost": 100.0,
                    "actual_cost": 450.0,
                    "deviation_percent": 350.0,
                    "severity": "critical",
                    "detection_method": "forced_simulation",
                    "anomaly_score": -0.85,
                    "status": "open",
                    "notes": "User requested simulation again",
                    "created_at": datetime.utcnow()
                }
                res = await db.anomalies.insert_one(doc)
                doc["_id"] = res.inserted_id
                print(f"Anomaly inserted for {email}.")
                
                # 4. Trigger alert
                from backend.services.alert_service import send_anomaly_alert
                await send_anomaly_alert(doc, account, user, db)
                print(f"Alert triggered for {email}.")
                
                # 5. Log activity
                from backend.utils.logger import log_activity
                await log_activity(
                    db, 
                    str(user["_id"]), 
                    "anomaly_detected", 
                    "anomaly", 
                    str(doc["_id"]),
                    {"severity": "critical", "service": "EC2"}
                )
    
    db.client.close()
    print("Closed.")

if __name__ == "__main__":
    asyncio.run(run())
