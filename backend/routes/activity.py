from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional
from datetime import datetime

from backend.db.mongodb import get_db
from backend.utils.jwt_utils import get_current_user
from backend.utils.response import paginated_response

router = APIRouter(tags=["activity"])

@router.get("")
async def get_activity(
    entity_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    uid = current_user["_id"]
    match_q = {"user_id": uid}
    
    if entity_type: match_q["entity_type"] = entity_type
    if start_date and end_date:
        try:
            match_q["timestamp"] = {
                "$gte": datetime.strptime(start_date, "%Y-%m-%d"),
                "$lte": datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            }
        except ValueError:
            pass
            
    skip = (page - 1) * limit
    cursor = db.activity_logs.find(match_q).sort("timestamp", -1).skip(skip).limit(limit)
    items = await cursor.to_list(None)
    total = await db.activity_logs.count_documents(match_q)
    
    for item in items:
        item["id"] = str(item.pop("_id"))
        item["user_id"] = str(item["user_id"])
        # Map fields to frontend expectations
        item["details"] = item.pop("metadata", {})
        item["actor"] = {"ip": item.get("ip_address") or "0.0.0.0", "role": "user"}
        
    return paginated_response(items, total, page, limit)
