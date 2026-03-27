from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from bson import ObjectId

from backend.config import settings
from backend.services.simulation_engine import SimulationEngine
from backend.services.anomaly_detector import AnomalyDetector
from backend.services.alert_service import send_anomaly_alert
from backend.services.ws_manager import broadcast_anomaly, broadcast_live_metrics
from backend.utils.logger import log_activity, logger
import math
import random
import time

# In-memory storage for stateful mock metrics
_user_metrics_state = {}


async def simulation_tick_job(app):
    try:
        from backend.db.mongodb import _db
        db = _db
        if not db:
            from backend.db.mongodb import get_db
            db = await get_db()
            
        cursor = db.users.find({})
        users = await cursor.to_list(length=None)
        
        for user in users:
            uid = user["_id"]
            state = await db.simulation_states.find_one({"user_id": uid})
            
            if state and state.get("is_running") == True:
                accounts = await db.cloud_accounts.find({"user_id": uid, "is_active": True}).to_list(length=None)
                
                for acc in accounts:
                    acc_id = acc["_id"]
                    provider = acc.get("provider", "aws")
                    
                    # Generate daily tick
                    await SimulationEngine.generate_daily_tick(str(acc_id), str(uid), provider, db)
                    
                    # Detect anomalies
                    new_anomalies = await AnomalyDetector.detect_anomalies_for_account(str(acc_id), str(uid), db)
                    
                    # Process detected anomalies
                    for anomaly_doc in new_anomalies:
                        account_doc = await db.cloud_accounts.find_one({"_id": ObjectId(acc_id)})
                        user_doc = await db.users.find_one({"_id": ObjectId(uid)})
                        
                        if account_doc and user_doc:
                            # Send real multi-channel alerts
                            await send_anomaly_alert(anomaly_doc, account_doc, user_doc, db)
                            
                            # WebSocket alert broadcast
                            # Convert ObjectIds for JSON serialization
                            anomaly_json = {
                                **anomaly_doc,
                                "_id": str(anomaly_doc["_id"]),
                                "id": str(anomaly_doc["_id"]),
                                "account_id": str(anomaly_doc["account_id"]),
                                "user_id": str(anomaly_doc["user_id"]),
                            }
                            if "created_at" in anomaly_json and anomaly_json["created_at"]:
                                anomaly_json["created_at"] = anomaly_json["created_at"].isoformat()
                            if "anomaly_date" in anomaly_json and anomaly_json["anomaly_date"]:
                                anomaly_json["anomaly_date"] = anomaly_json["anomaly_date"].isoformat()
                            
                            # Mark type for precise routing
                            anomaly_json["type"] = "new_anomaly"
                            await broadcast_anomaly(str(uid), anomaly_json)
                
                new_count = state.get("tick_count", 0) + 1
                await db.simulation_states.update_one(
                    {"user_id": uid},
                    {"$set": {"last_tick_at": datetime.utcnow(), "tick_count": new_count}}
                )
                await log_activity(db, str(uid), "simulation_tick_job", "system", str(uid), {"tick_count": new_count})
                
    except Exception as e:
        logger.error(f"Error in simulation tick job: {e}")

async def live_metrics_job(app):
    try:
        from backend.db.mongodb import _db
        db = _db
        if not db:
            return
            
        cursor = db.users.find({})
        users = await cursor.to_list(length=None)
        
        t = time.time()
        
        for user in users:
            uid = str(user["_id"])
            state = await db.simulation_states.find_one({"user_id": ObjectId(uid)})
            
            if state and state.get("is_running") == True:
                if uid not in _user_metrics_state:
                    _user_metrics_state[uid] = {"storage": 50.0, "cost": 10.0}
                
                # Sine wave with noise
                cpu = max(0, min(100, 50 + 30 * math.sin(t / 5) + random.uniform(-10, 10)))
                
                # 45s GC cycle (t % 45). Ramp up from 30 to 80, drop to 30.
                gc_progress = (t % 45) / 45
                memory = 30 + (50 * gc_progress) + random.uniform(-2, 2)
                
                # Slowly growing storage
                _user_metrics_state[uid]["storage"] += 0.001
                storage = _user_metrics_state[uid]["storage"]
                
                # Random traffic spikes
                network = random.uniform(10, 50)
                if random.random() > 0.9:
                    network += random.uniform(100, 300)
                
                # Cost rate accumulation
                _user_metrics_state[uid]["cost"] += 0.015
                cost = _user_metrics_state[uid]["cost"]
                
                metrics = {
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "cpu": float(f"{cpu:.1f}"),
                    "memory": float(f"{memory:.1f}"),
                    "storage": float(f"{storage:.3f}"),
                    "network": float(f"{network:.1f}"),
                    "cost": float(f"{cost:.2f}"),
                    "tick": state.get("tick_count", 0)
                }
                
                await broadcast_live_metrics(uid, metrics)
                
    except Exception as e:
        logger.error(f"Error in live metrics job: {e}")

def start_scheduler(app):
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        simulation_tick_job,
        'interval',
        seconds=settings.simulation_tick_interval_seconds,
        args=[app]
    )
    scheduler.add_job(
        live_metrics_job,
        'interval',
        seconds=1,
        args=[app]
    )
    scheduler.start()
    return scheduler
