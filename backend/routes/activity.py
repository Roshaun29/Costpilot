from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from db.mysql import get_db
from models.activity_log import ActivityLog, ActivityLogResponse
from models.user import User
from utils.jwt_utils import get_current_user
from utils.response import paginated_response

router = APIRouter(tags=["activity"])

@router.get("", response_model=None)
async def get_activity(
    entity_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = current_user.id
    stmt = select(ActivityLog).where(ActivityLog.user_id == uid)
    
    if entity_type: 
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
        
    if start_date and end_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            ed = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            stmt = stmt.where(ActivityLog.created_at >= sd, ActivityLog.created_at <= ed)
        except ValueError:
            pass
            
    # Pagination
    offset = (page - 1) * limit
    
    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    
    # Fetch items
    res = await db.execute(stmt.order_by(desc(ActivityLog.created_at)).offset(offset).limit(limit))
    items = res.scalars().all()
    
    # Map to frontend expectations
    results = []
    for item in items:
        results.append({
            "id": item.id,
            "user_id": item.user_id,
            "action": item.action,
            "entity_type": item.entity_type,
            "entity_id": item.entity_id,
            "details": item.meta_data or {},
            "ip_address": item.ip_address,
            "timestamp": item.created_at,
            "actor": {"ip": item.ip_address or "0.0.0.0", "role": "user"}
        })
        
    return paginated_response(results, total, page, limit)
