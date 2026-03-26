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
from backend.services.alert_service import evaluate_rules_for_anomaly

async def run():
    print("Connecting to Mongo...")
    await connect_to_mongo()
    db = get_db()
    
    # 1. Get current user
    user = await db.users.find_one({"email": "final@example.com"})
    if not user:
        print("User not found")
        return
        
    # 2. Get first account
    account = await db.cloud_accounts.find_one({"user_id": user["_id"]})
    if not account:
        print("No accounts found for user")
        return
        
    # 3. Create a forced anomaly
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
        "notes": "User requested simulation",
        "created_at": datetime.utcnow()
    }
    
    res = await db.anomalies.insert_one(doc)
    doc["_id"] = res.inserted_id
    print(f"Anomaly inserted: {res.inserted_id}")
    
    # 4. Trigger rules
    print("Triggering alert rules for SMS...")
    try:
        from backend.services.alert_service import send_anomaly_alert
        await send_anomaly_alert(doc, account, user, db)
        print("Alert service triggered successfully.")
    except Exception as e:
        print(f"Alert trigger failed: {str(e)}")
    
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
    
    # Close client
    db.client.close()
    print("Closed.")

if __name__ == "__main__":
    asyncio.run(run())
