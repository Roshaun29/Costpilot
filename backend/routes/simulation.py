from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from pydantic import BaseModel
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response
from backend.utils.logger import log_activity
from backend.services.simulation_engine import SimulationEngine
from backend.services.anomaly_detector import AnomalyDetector

router = APIRouter(tags=["simulation"])

@router.get("/status")
async def get_simulation_status(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    state = await db.simulation_states.find_one({"user_id": uid})
    if not state:
        state = {
            "user_id": uid,
            "is_running": False,
            "last_tick_at": None,
            "tick_count": 0,
            "started_at": None
        }
        await db.simulation_states.insert_one(state)
        
    active_accounts = await db.cloud_accounts.count_documents({"user_id": uid, "is_active": True})
    
    return success_response({
        "is_running": state.get("is_running", False),
        "last_tick_at": state.get("last_tick_at"),
        "tick_count": state.get("tick_count", 0),
        "accounts_monitored": active_accounts,
        "started_at": state.get("started_at")
    }, "Simulation status retrieved")

@router.post("/start")
async def start_simulation(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    now = datetime.utcnow()
    await db.simulation_states.update_one(
        {"user_id": uid},
        {"$set": {"is_running": True, "started_at": now}},
        upsert=True
    )
    await log_activity(db, str(uid), "simulation_started", "simulation", "system")
    
    state = await db.simulation_states.find_one({"user_id": uid})
    state.pop("_id", None)
    state["user_id"] = str(state["user_id"])
    return success_response(state, "Simulation started")

@router.post("/stop")
async def stop_simulation(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    await db.simulation_states.update_one(
        {"user_id": uid},
        {"$set": {"is_running": False}},
        upsert=True
    )
    await log_activity(db, str(uid), "simulation_stopped", "simulation", "system")
    
    state = await db.simulation_states.find_one({"user_id": uid})
    state.pop("_id", None)
    state["user_id"] = str(state["user_id"])
    return success_response(state, "Simulation stopped")

@router.post("/tick")
async def manual_tick(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    accounts = await db.cloud_accounts.find({"user_id": uid, "is_active": True}).to_list(length=None)
    
    data_points = 0
    anomalies_detected = 0
    for acc in accounts:
        provider = acc.get("provider", "aws")
        docs = await SimulationEngine.generate_daily_tick(str(acc["_id"]), str(uid), provider, db)
        data_points += len(docs)
        anoms = await AnomalyDetector.detect_anomalies_for_account(str(acc["_id"]), str(uid), db)
        anomalies_detected += len(anoms)
        
    await log_activity(db, str(uid), "manual_tick", "simulation", "system", {"data_points": data_points})
    return success_response({
        "accounts_processed": len(accounts),
        "data_points_generated": data_points,
        "anomalies_detected": anomalies_detected
    }, "Manual tick completed")

class InjectAnomalyRequest(BaseModel):
    account_id: str
    service: str
    anomaly_type: str

@router.post("/inject-anomaly")
async def inject_anomaly(req: InjectAnomalyRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    acc = await db.cloud_accounts.find_one({"_id": ObjectId(req.account_id), "user_id": uid})
    if not acc:
        return error_response("Account not found", status.HTTP_404_NOT_FOUND)
        
    if req.anomaly_type not in ["spike", "drift", "drop"]:
        return error_response("Invalid anomaly type", status.HTTP_400_BAD_REQUEST)
        
    provider = acc.get("provider", "aws")
    await SimulationEngine.generate_daily_tick(req.account_id, str(uid), provider, db, force_anomaly=req.anomaly_type)
    
    anoms = await AnomalyDetector.detect_anomalies_for_account(req.account_id, str(uid), db)
    
    await log_activity(db, str(uid), "inject_anomaly", "simulation", req.anomaly_type)
    
    for a in anoms:
        a["_id"] = str(a["_id"])
        a["account_id"] = str(a["account_id"])
        a["user_id"] = str(a["user_id"])
        a.pop("created_at", None)

    return success_response({"injected_anomalies": anoms}, "Anomaly injected and detection run")
