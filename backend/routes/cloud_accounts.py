from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import random
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response
from backend.utils.logger import log_activity
from backend.models.cloud_account import CloudAccountCreate, CloudAccountUpdate, ProviderEnum
from backend.services.simulation_engine import SimulationEngine
from backend.services.anomaly_detector import AnomalyDetector

router = APIRouter(tags=["cloud-accounts"])

@router.get("")
async def get_accounts(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    cursor = db.cloud_accounts.find({"user_id": uid})
    accounts = await cursor.to_list(length=None)
    for a in accounts:
        a["id"] = str(a.pop("_id"))
        a["user_id"] = str(a["user_id"])
    return success_response(accounts)

@router.post("")
async def create_account(acc: CloudAccountCreate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    
    if acc.provider == ProviderEnum.aws:
        sim_id = str(random.randint(100000000000, 999999999999))
    else:
        sim_id = str(uuid.uuid4())
        
    doc = acc.model_dump()
    doc["user_id"] = uid
    doc["account_id_simulated"] = sim_id
    doc["sync_status"] = "idle"
    doc["last_synced_at"] = None
    doc["created_at"] = datetime.utcnow()
    
    res = await db.cloud_accounts.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id")
    doc["user_id"] = str(uid)
    
    await SimulationEngine.generate_historical_data(doc["id"], str(uid), acc.provider.value, db)
    
    await db.cloud_accounts.update_one(
        {"_id": res.inserted_id},
        {"$set": {"sync_status": "synced", "last_synced_at": datetime.utcnow()}}
    )
    doc["sync_status"] = "synced"
    doc["last_synced_at"] = datetime.utcnow()
    
    await log_activity(db, str(uid), "account_added", "cloud_account", doc["id"])
    return success_response(doc, "Account created", status.HTTP_201_CREATED)

@router.put("/{id}")
async def update_account(id: str, updates: CloudAccountUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        return error_response("No fields to update")
        
    res = await db.cloud_accounts.find_one_and_update(
        {"_id": ObjectId(id), "user_id": uid},
        {"$set": update_data},
        return_document=True
    )
    if not res:
        return error_response("Account not found", status.HTTP_404_NOT_FOUND)
        
    res["id"] = str(res.pop("_id"))
    res["user_id"] = str(res["user_id"])
    
    await log_activity(db, str(uid), "account_updated", "cloud_account", id, {"fields": list(update_data.keys())})
    return success_response(res, "Account updated")

@router.delete("/{id}")
async def delete_account(id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    acc = await db.cloud_accounts.find_one({"_id": ObjectId(id), "user_id": uid})
    if not acc:
        return error_response("Account not found", status.HTTP_404_NOT_FOUND)
        
    await db.cloud_accounts.delete_one({"_id": ObjectId(id)})
    await db.cost_data.delete_many({"account_id": ObjectId(id)})
    await db.anomalies.delete_many({"account_id": ObjectId(id)})
    
    await log_activity(db, str(uid), "account_deleted", "cloud_account", id)
    return success_response(None, "Account deleted")

@router.post("/{id}/sync")
async def sync_account(id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    acc = await db.cloud_accounts.find_one({"_id": ObjectId(id), "user_id": uid})
    if not acc:
        return error_response("Account not found", status.HTTP_404_NOT_FOUND)
        
    await db.cloud_accounts.update_one({"_id": ObjectId(id)}, {"$set": {"sync_status": "syncing"}})
    
    docs = await SimulationEngine.generate_daily_tick(id, str(uid), acc["provider"], db)
    anoms = await AnomalyDetector.detect_anomalies_for_account(id, str(uid), db)
    
    await db.cloud_accounts.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"sync_status": "synced", "last_synced_at": datetime.utcnow()}}
    )
    
    await log_activity(db, str(uid), "manual_sync", "cloud_account", id)
    return success_response({
        "sync_status": "synced",
        "new_data_points": len(docs),
        "anomalies_detected": len(anoms)
    }, "Account synced")
