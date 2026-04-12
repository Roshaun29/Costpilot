from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from config import settings
from services.simulation_engine import SimulationEngine
from services.anomaly_detector import AnomalyDetector
from services.alert_service import send_anomaly_alert
from services.ws_manager import broadcast_anomaly, broadcast_live_metrics
from utils.logger import log_activity, logger
import db.mysql as db_mysql
from models.user import User
from models.simulation import SimulationState
from models.cloud_account import CloudAccount
from services.live_simulator import live_simulator

async def simulation_tick_job(app):
    """Periodic job to generate historical-style daily ticks and detect anomalies."""
    async with db_mysql.async_session() as db:
        try:
            # Get all users with running simulations
            stmt = select(User, SimulationState).join(SimulationState, User.id == SimulationState.user_id).where(SimulationState.is_running == True)
            result = await db.execute(stmt)
            active_users = result.all()
            
            for user, state in active_users:
                # Get active accounts for this user
                acc_stmt = select(CloudAccount).where(CloudAccount.user_id == user.id, CloudAccount.is_active == True)
                acc_res = await db.execute(acc_stmt)
                accounts = acc_res.scalars().all()
                
                for acc in accounts:
                    # Generate a "daily" tick in simulation time
                    # This simulates a full day of data processed in one tick for historical graphs
                    await SimulationEngine.generate_daily_tick(acc.id, user.id, acc.provider, db)
                    
                    # Run anomaly detection on the newly updated data
                    new_anomalies = await AnomalyDetector.detect_anomalies_for_account(acc.id, user.id, db)
                    
                    # Process and broadcast any found anomalies
                    for anomaly in new_anomalies:
                        # Send multi-channel alerts (SMS/Email/In-App)
                        await send_anomaly_alert(anomaly, acc, user, db)
                        
                        # Direct WebSocket push for real-time UI notification
                        anomaly_json = {
                            "id": anomaly.id,
                            "account_id": anomaly.account_id,
                            "user_id": anomaly.user_id,
                            "service": anomaly.service,
                            "anomaly_date": anomaly.anomaly_date.isoformat(),
                            "actual_cost": float(anomaly.actual_cost),
                            "expected_cost": float(anomaly.expected_cost),
                            "severity": anomaly.severity,
                            "type": "new_anomaly"
                        }
                        await broadcast_anomaly(user.id, anomaly_json)
                
                # Update simulation state
                state.tick_count += 1
                state.last_tick_at = datetime.utcnow()
                db.add(state)
                await db.commit()
                
                await log_activity(db, user.id, "simulation_tick", "system", user.id, {"tick": state.tick_count})
                
        except Exception as e:
            logger.error(f"Error in simulation tick job: {e}")
            await db.rollback()

async def live_metrics_job(app):
    """High-frequency job (1s) to broadcast real-time operational metrics for the live dashboard."""
    async with db_mysql.async_session() as db:
        try:
            # We fetch user/state pairs without joining to keep it fast
            stmt = select(User.id).join(SimulationState, User.id == SimulationState.user_id).where(SimulationState.is_running == True)
            result = await db.execute(stmt)
            active_user_ids = result.scalars().all()
            
            for uid in active_user_ids:
                # Get active accounts for metrics generation
                acc_stmt = select(CloudAccount.id, CloudAccount.provider).where(CloudAccount.user_id == uid, CloudAccount.is_active == True)
                acc_res = await db.execute(acc_stmt)
                accounts = acc_res.all()
                
                for account_id, provider in accounts:
                    # Ensure simulator is ready for this account
                    live_simulator.initialize_account(account_id, provider)
                    
                    # Generate the 1-second metric tick
                    metrics = live_simulator.get_live_tick(account_id)
                    
                    # Broadcast to user via WebSocket
                    await broadcast_live_metrics(uid, metrics)
                    
        except Exception as e:
            logger.error(f"Error in live metrics job: {e}")

def start_scheduler(app):
    """Initializes and starts the APScheduler with configured intervals."""
    scheduler = AsyncIOScheduler()
    
    # Historical-style processing (every 30s by default)
    scheduler.add_job(
        simulation_tick_job,
        'interval',
        seconds=settings.SIMULATION_TICK_INTERVAL_SECONDS,
        args=[app]
    )
    
    # Real-time dashboard streaming (every 1s)
    scheduler.add_job(
        live_metrics_job,
        'interval',
        seconds=1,
        args=[app]
    )
    
    scheduler.start()
    return scheduler
