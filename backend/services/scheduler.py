from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from backend.config import settings
from backend.services.simulation_engine import SimulationEngine
from backend.services.anomaly_detector import AnomalyDetector
from backend.utils.logger import log_activity, logger

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
                    await AnomalyDetector.detect_anomalies_for_account(str(acc_id), str(uid), db)
                
                new_count = state.get("tick_count", 0) + 1
                await db.simulation_states.update_one(
                    {"user_id": uid},
                    {"$set": {"last_tick_at": datetime.utcnow(), "tick_count": new_count}}
                )
                
                await log_activity(db, str(uid), "simulation_tick_job", "system", str(uid), {"tick_count": new_count})
                
    except Exception as e:
        logger.error(f"Error in simulation tick job: {e}")

def start_scheduler(app):
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        simulation_tick_job,
        'interval',
        seconds=settings.simulation_tick_interval_seconds,
        args=[app]
    )
    scheduler.start()
    return scheduler
