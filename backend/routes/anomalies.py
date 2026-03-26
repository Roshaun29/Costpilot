from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response, paginated_response
from backend.utils.logger import log_activity
from datetime import timedelta

router = APIRouter(tags=["anomalies"])

@router.get("")
async def get_anomalies(
    severity: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    uid = current_user["_id"]
    match_q = {"user_id": uid}
    
    if severity: match_q["severity"] = severity
    if status_: match_q["status"] = status_
    if account_id: match_q["account_id"] = ObjectId(account_id)
    if start_date and end_date:
        try:
            match_q["anomaly_date"] = {
                "$gte": datetime.strptime(start_date, "%Y-%m-%d"),
                "$lte": datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            }
        except ValueError:
            pass
            
    skip = (page - 1) * limit
    
    pipeline = [
        {"$match": match_q},
        {"$sort": {"anomaly_date": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "cloud_accounts",
                "localField": "account_id",
                "foreignField": "_id",
                "as": "account"
            }
        },
        {"$unwind": {"path": "$account", "preserveNullAndEmptyArrays": True}}
    ]
    
    items = await db.anomalies.aggregate(pipeline).to_list(length=None)
    total = await db.anomalies.count_documents(match_q)
    
    for item in items:
        item["id"] = str(item.pop("_id"))
        item["user_id"] = str(item["user_id"])
        item["account_id"] = str(item["account_id"])
        if "account" in item and item["account"]:
            item["account_name"] = item["account"].get("account_name")
            item.pop("account")
            
    return paginated_response(items, total, page, limit)

@router.get("/stats")
async def get_anomaly_stats(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    
    total_open = await db.anomalies.count_documents({"user_id": uid, "status": "open"})
    
    pipe_sev = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$severity", "count": {"$sum": 1}}}]
    sev_counts = {r["_id"]: r["count"] for r in await db.anomalies.aggregate(pipe_sev).to_list(None)}
    
    pipe_stat = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    stat_counts = {r["_id"]: r["count"] for r in await db.anomalies.aggregate(pipe_stat).to_list(None)}
    
    pipe_open = [{"$match": {"user_id": uid, "status": "open"}}, {"$group": {"_id": None, "avg_dev": {"$avg": "$deviation_percent"}}}]
    open_avg_res = await db.anomalies.aggregate(pipe_open).to_list(None)
    avg_dev = open_avg_res[0]["avg_dev"] if open_avg_res else 0.0
    
    pipe_svc = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$service", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 1}]
    most_affected = await db.anomalies.aggregate(pipe_svc).to_list(None)
    most_affected_svc = most_affected[0]["_id"] if most_affected else None
    
    return success_response({
        "total_open": total_open,
        "by_severity": sev_counts,
        "by_status": stat_counts,
        "avg_deviation": round(avg_dev, 2) if avg_dev else 0,
        "most_affected_service": most_affected_svc
    })

@router.get("/{id}")
async def get_anomaly(id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    anom = await db.anomalies.find_one({"_id": ObjectId(id), "user_id": uid})
    if not anom:
        return error_response("Anomaly not found", 404)
        
    acc = await db.cloud_accounts.find_one({"_id": anom["account_id"]})
    anom["account_name"] = acc.get("account_name") if acc else None
    
    hist = await db.cost_data.find({
        "account_id": anom["account_id"],
        "service": anom["service"],
        "date": {"$gte": anom["anomaly_date"] - timedelta(days=30), "$lte": anom["anomaly_date"] + timedelta(days=5)}
    }).sort("date", 1).to_list(None)
    
    history = [{"date": h["date"], "cost_usd": h["cost_usd"], "is_anomaly": h["is_anomaly"]} for h in hist]
    
    anom["id"] = str(anom.pop("_id"))
    anom["account_id"] = str(anom["account_id"])
    anom["user_id"] = str(anom["user_id"])
    anom["history"] = history
    return success_response(anom)

class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

@router.put("/{id}/status")
async def update_status(id: str, payload: StatusUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if payload.status not in ["acknowledged", "resolved"]:
        return error_response("Invalid status")
        
    uid = current_user["_id"]
    res = await db.anomalies.find_one_and_update(
        {"_id": ObjectId(id), "user_id": uid},
        {"$set": {"status": payload.status, "notes": payload.notes}},
        return_document=True
    )
    if not res:
        return error_response("Anomaly not found", 404)
        
    res["id"] = str(res.pop("_id"))
    res["account_id"] = str(res["account_id"])
    res["user_id"] = str(res["user_id"])
    
    await log_activity(db, str(uid), "anomaly_status_updated", "anomaly", id, {"status": payload.status})
    return success_response(res)
