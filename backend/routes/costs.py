from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response, error_response

router = APIRouter(tags=["costs"])

@router.get("")
async def get_costs(
    start_date: str,
    end_date: str,
    account_id: Optional[str] = None,
    service: Optional[str] = None,
    granularity: str = Query("daily", regex="^(daily|weekly|monthly)$"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    uid = current_user["_id"]
    match_q = {"user_id": uid}
    try:
        match_q["date"] = {
            "$gte": datetime.strptime(start_date, "%Y-%m-%d"),
            "$lte": datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        }
    except ValueError:
        return error_response("Invalid date format. Use YYYY-MM-DD", 400)
        
    if account_id: match_q["account_id"] = ObjectId(account_id)
    if service: match_q["service"] = service
    
    date_format_map = {
        "daily": "%Y-%m-%d",
        "weekly": "%Y-%U",
        "monthly": "%Y-%m"
    }
    date_format = date_format_map.get(granularity, "%Y-%m-%d")
    
    pipeline = [
        {"$match": match_q},
        {
            "$group": {
                "_id": {
                    "date": {"$dateToString": {"format": date_format, "date": "$date"}},
                    "service": "$service"
                },
                "cost_usd": {"$sum": "$cost_usd"},
                "is_anomaly": {"$max": "$is_anomaly"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "date": "$_id.date",
                "service": "$_id.service",
                "cost_usd": {"$round": ["$cost_usd", 2]},
                "is_anomaly": 1
            }
        },
        {"$sort": {"date": 1, "service": 1}}
    ]
    
    results = await db.cost_data.aggregate(pipeline).to_list(length=None)
    return success_response(results)

@router.get("/summary")
async def get_cost_summary(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    now = datetime.utcnow()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    if current_month_start.month == 1:
        prev_month_start = current_month_start.replace(year=current_month_start.year - 1, month=12)
    else:
        prev_month_start = current_month_start.replace(month=current_month_start.month - 1)
    prev_month_end = current_month_start - timedelta(seconds=1)
    
    pipeline_current = [
        {"$match": {"user_id": uid, "date": {"$gte": current_month_start}}},
        {"$group": {
            "_id": None, 
            "total": {"$sum": "$cost_usd"},
            "services": {"$push": {"service": "$service", "cost": "$cost_usd"}},
            "accounts": {"$push": {"account": "$account_id", "cost": "$cost_usd"}}
        }}
    ]
    curr_res = await db.cost_data.aggregate(pipeline_current).to_list(length=1)
    
    pipeline_prev = [
        {"$match": {"user_id": uid, "date": {"$gte": prev_month_start, "$lte": prev_month_end}}},
        {"$group": {"_id": None, "total": {"$sum": "$cost_usd"}}}
    ]
    prev_res = await db.cost_data.aggregate(pipeline_prev).to_list(length=1)
    
    curr_total = curr_res[0]["total"] if curr_res else 0.0
    prev_total = prev_res[0]["total"] if prev_res else 0.0
    
    delta = 0.0
    if prev_total > 0:
        delta = ((curr_total - prev_total) / prev_total) * 100
        
    service_breakdown = {}
    account_breakdown = {}
    if curr_res:
        for item in curr_res[0]["services"]:
            service_breakdown[item["service"]] = service_breakdown.get(item["service"], 0) + item["cost"]
        for item in curr_res[0]["accounts"]:
            aid = str(item["account"])
            account_breakdown[aid] = account_breakdown.get(aid, 0) + item["cost"]
            
    top_services = [{"service": k, "cost": round(v, 2)} for k, v in sorted(service_breakdown.items(), key=lambda x: x[1], reverse=True)[:6]]
    acc_formatted = {k: round(v, 2) for k, v in account_breakdown.items()}
    
    days_in_month = (current_month_start.replace(month=current_month_start.month % 12 + 1, day=1) - timedelta(days=1)).day
    days_passed = max(1, now.day)
    projected = (curr_total / days_passed) * days_in_month
    
    return success_response({
        "current_month_total": round(curr_total, 2),
        "previous_month_total": round(prev_total, 2),
        "delta_percent": round(delta, 2),
        "top_services": top_services,
        "accounts": acc_formatted,
        "projected_month_end": round(projected, 2)
    })

@router.get("/services")
async def get_services(account_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    services = await db.cost_data.distinct("service", {"account_id": ObjectId(account_id), "user_id": uid})
    return success_response(services)
