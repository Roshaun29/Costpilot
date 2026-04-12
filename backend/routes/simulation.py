from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from datetime import datetime
from db.mysql import get_db
from models.simulation import SimulationState, SimulationStatusResponse
from models.cloud_account import CloudAccount
from models.user import User
from utils.jwt_utils import get_current_user
from utils.response import success_response, error_response
from services.simulation_engine import SimulationEngine
from services.anomaly_detector import AnomalyDetector

from sqlalchemy.dialects.mysql import insert as mysql_insert

router = APIRouter()

async def get_or_create_simulation_state(user_id: str, db: AsyncSession):
    """Get existing state or create default. Never creates duplicates."""
    result = await db.execute(
        select(SimulationState).where(SimulationState.user_id == user_id)
    )
    state = result.scalar_one_or_none()
    if state:
        return state
    
    # Use INSERT IGNORE to handle race conditions
    stmt = mysql_insert(SimulationState).values(
        user_id=user_id,
        is_running=False,
        tick_count=0
    ).prefix_with("IGNORE")
    await db.execute(stmt)
    await db.commit()
    
    result = await db.execute(
        select(SimulationState).where(SimulationState.user_id == user_id)
    )
    return result.scalar_one()

@router.get("/status")
async def get_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    state = await get_or_create_simulation_state(current_user.id, db)
        
    acc_count = await db.execute(
        select(func.count(CloudAccount.id)).where(CloudAccount.user_id == current_user.id, CloudAccount.is_active == True)
    )
    
    return success_response({
        "is_running": state.is_running,
        "last_tick_at": state.last_tick_at,
        "tick_count": state.tick_count,
        "accounts_monitored": acc_count.scalar(),
        "started_at": state.started_at
    })

@router.post("/start")
async def start_sim(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(SimulationState)
        .where(SimulationState.user_id == current_user.id)
        .values(is_running=True, started_at=datetime.utcnow())
    )
    await db.flush()
    return success_response(None, "Simulation started")

@router.post("/stop")
async def stop_sim(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(SimulationState)
        .where(SimulationState.user_id == current_user.id)
        .values(is_running=False)
    )
    await db.flush()
    return success_response(None, "Simulation stopped")

@router.post("/tick")
async def manual_tick(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudAccount).where(CloudAccount.user_id == current_user.id, CloudAccount.is_active == True))
    accounts = result.scalars().all()
    
    data_points = 0
    anomalies_detected = 0
    
    for acc in accounts:
        # Note: These services need to be updated to take (acc.id, user.id, db) too if needed
        # Assuming the caller has refactored those services or I will next
        docs = await SimulationEngine.generate_daily_tick(acc.id, current_user.id, acc.provider, db)
        data_points += len(docs)
        anoms = await AnomalyDetector.detect_anomalies_for_account(acc.id, current_user.id, db)
        anomalies_detected += len(anoms)
        
    return success_response({
        "accounts_processed": len(accounts),
        "data_points_generated": data_points,
        "anomalies_detected": anomalies_detected
    }, "Manual tick completed")
