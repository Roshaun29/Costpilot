from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func, delete
from db.mysql import get_db
from models.alert import Alert, AlertResponse
from models.user import User
from utils.jwt_utils import get_current_user
from typing import List, Optional

router = APIRouter()

@router.get("/unread-count")
async def unread_count(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Must be before /{id} routes to avoid route conflicts."""
    result = await db.execute(
        select(func.count(Alert.id))
        .where(Alert.user_id == current_user.id, Alert.is_read == False)
    )
    return {"count": result.scalar()}

@router.get("")
async def list_alerts(
    read: Optional[bool] = None,
    channel: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Alert).where(Alert.user_id == current_user.id)
    count_stmt = select(func.count(Alert.id)).where(Alert.user_id == current_user.id)
    
    if read is not None:
        stmt = stmt.where(Alert.is_read == read)
        count_stmt = count_stmt.where(Alert.is_read == read)
    if channel:
        stmt = stmt.where(Alert.channel == channel)
        count_stmt = count_stmt.where(Alert.channel == channel)
        
    stmt = stmt.order_by(desc(Alert.sent_at))
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    count_res = await db.execute(count_stmt)
    
    alerts = result.scalars().all()
    total = count_res.scalar() or 0
    
    return {"success": True, "data": {"items": alerts, "total": total}}

@router.put("/mark-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read_put(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Original mark-read endpoint (PUT)."""
    await db.execute(
        update(Alert)
        .where(Alert.user_id == current_user.id, Alert.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return None

@router.patch("/read-all")
async def mark_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mark all alerts as read (PATCH /read-all used by frontend)."""
    await db.execute(
        update(Alert)
        .where(Alert.user_id == current_user.id, Alert.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"success": True, "message": "All alerts marked as read"}

@router.patch("/{id}/read")
async def mark_one_read(id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mark a single alert as read."""
    result = await db.execute(select(Alert).where(Alert.id == id, Alert.user_id == current_user.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.add(alert)
    await db.commit()
    return {"success": True}

@router.delete("/{id}")
async def delete_alert(id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete a specific alert."""
    result = await db.execute(select(Alert).where(Alert.id == id, Alert.user_id == current_user.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
    await db.commit()
    return {"success": True}
