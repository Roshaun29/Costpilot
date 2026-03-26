from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import success_response
from backend.services.insights_service import generate_insights

router = APIRouter(tags=["insights"])

@router.get("")
async def get_insights(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    items = await db.insights.find({"user_id": uid}).sort("created_at", -1).limit(10).to_list(None)
    
    if not items:
        items = await generate_insights(str(uid), db)
    
    for item in items:
        item["id"] = str(item.pop("_id", item.get("id")))
        item["user_id"] = str(item["user_id"])
        item["account_id"] = str(item.get("account_id")) if item.get("account_id") else None
        item["related_anomaly_id"] = str(item.get("related_anomaly_id")) if item.get("related_anomaly_id") else None
        
    return success_response(items)

@router.post("/generate")
async def manual_generate(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    uid = current_user["_id"]
    items = await generate_insights(str(uid), db)
    for item in items:
        item["id"] = str(item.pop("_id", item.get("id")))
        item["user_id"] = str(item["user_id"])
        item["account_id"] = str(item.get("account_id")) if item.get("account_id") else None
        item["related_anomaly_id"] = str(item.get("related_anomaly_id")) if item.get("related_anomaly_id") else None
        
    return success_response(items, "Insights generated successfully")
