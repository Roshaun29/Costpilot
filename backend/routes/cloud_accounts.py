from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from db.mysql import get_db
from models.cloud_account import CloudAccount, CloudAccountCreate, CloudAccountResponse
from models.user import User
from utils.jwt_utils import get_current_user
from typing import List
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from services.simulation_engine import SimulationEngine
from services.live_simulator import live_simulator
import uuid

router = APIRouter()

@router.get("")
async def list_accounts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudAccount).where(CloudAccount.user_id == current_user.id))
    accounts = result.scalars().all()
    return {"success": True, "data": [CloudAccountResponse.model_validate(a) for a in accounts]}

@router.post("")
async def create_account(data: CloudAccountCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        sim_acc_id = f"{data.provider.lower()}-{uuid.uuid4().hex[:12]}"
        
        account = CloudAccount(
            user_id=user.id,
            provider=data.provider,
            account_name=data.account_name,
            region=data.region,
            monthly_budget=data.monthly_budget,
            account_id_simulated=sim_acc_id,
            sync_status="syncing"
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)
        
        # Generate historical data (90 days)
        await SimulationEngine.generate_historical_data(
            account.id, user.id, data.provider, db
        )
        
        # Update sync status
        account.sync_status = "synced"
        account.last_synced_at = datetime.utcnow()
        await db.commit()
        
        # Initialize live simulator
        live_simulator.initialize_account(account.id, data.provider)
        
        return {"success": True, "data": CloudAccountResponse.model_validate(account)}
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Account creation failed: {str(e)}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.post("/{id}/sync")
async def sync_account(id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Trigger a re-sync (regenerate historical data) for an existing account."""
    result = await db.execute(select(CloudAccount).where(CloudAccount.id == id, CloudAccount.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cloud account not found")
    
    try:
        account.sync_status = "syncing"
        await db.commit()
        
        await SimulationEngine.generate_historical_data(account.id, current_user.id, account.provider, db)
        
        account.sync_status = "synced"
        account.last_synced_at = datetime.utcnow()
        await db.commit()
        await db.refresh(account)
        
        live_simulator.initialize_account(account.id, account.provider)
        return {"success": True, "data": CloudAccountResponse.model_validate(account)}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@router.post("/connect-real")
async def connect_real_account(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Stub for connecting a real cloud account (AWS SDK, etc.). Returns simulated for now."""
    raise HTTPException(status_code=501, detail="Real cloud account connection is not yet implemented. Use simulated accounts.")

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudAccount).where(CloudAccount.id == id, CloudAccount.user_id == current_user.id))
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Cloud account not found")
        
    await db.delete(acc)
    await db.commit()
    return None
