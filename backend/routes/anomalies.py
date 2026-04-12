from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from db.mysql import get_db
from models.anomaly import AnomalyResult, AnomalyResponse, AnomalyStatusUpdate
from models.user import User
from utils.jwt_utils import get_current_user
from typing import List, Optional

router = APIRouter()

@router.get("/stats")
async def get_anomaly_stats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Must be defined BEFORE /{id} to avoid route conflicts."""
    import json as json_lib
    
    total_res = await db.execute(select(func.count(AnomalyResult.id)).where(AnomalyResult.user_id == current_user.id))
    total = total_res.scalar() or 0
    
    open_res = await db.execute(select(func.count(AnomalyResult.id)).where(AnomalyResult.user_id == current_user.id, AnomalyResult.status == "open"))
    open_count = open_res.scalar() or 0
    
    resolved_res = await db.execute(select(func.count(AnomalyResult.id)).where(AnomalyResult.user_id == current_user.id, AnomalyResult.status == "resolved"))
    resolved_count = resolved_res.scalar() or 0
    
    # Severity breakdown
    sev_res = await db.execute(
        select(AnomalyResult.severity, func.count(AnomalyResult.id))
        .where(AnomalyResult.user_id == current_user.id, AnomalyResult.status == "open")
        .group_by(AnomalyResult.severity)
    )
    by_severity = {row[0]: row[1] for row in sev_res.all()}
    
    # Average deviation
    avg_res = await db.execute(
        select(func.avg(AnomalyResult.deviation_percent)).where(AnomalyResult.user_id == current_user.id)
    )
    avg_dev = avg_res.scalar() or 0.0
    
    return {
        "success": True, 
        "data": {
            "total_count": total,
            "total_open": open_count,
            "avg_deviation": round(float(avg_dev), 1),
            "by_severity": {
                "critical": by_severity.get("critical", 0),
                "high": by_severity.get("high", 0),
                "medium": by_severity.get("medium", 0),
                "low": by_severity.get("low", 0),
            },
            "by_status": {
                "open": open_count,
                "resolved": resolved_count,
                "acknowledged": total - open_count - resolved_count,
            }
        }
    }

@router.get("")
async def list_anomalies(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    account_id: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AnomalyResult).where(AnomalyResult.user_id == current_user.id).order_by(desc(AnomalyResult.detected_at))
    count_stmt = select(func.count(AnomalyResult.id)).where(AnomalyResult.user_id == current_user.id)
    
    if status:
        stmt = stmt.where(AnomalyResult.status == status.lower())
        count_stmt = count_stmt.where(AnomalyResult.status == status.lower())
    if severity:
        stmt = stmt.where(AnomalyResult.severity == severity.lower())
        count_stmt = count_stmt.where(AnomalyResult.severity == severity.lower())
    if account_id:
        stmt = stmt.where(AnomalyResult.account_id == account_id)
        count_stmt = count_stmt.where(AnomalyResult.account_id == account_id)
    
    # Pagination
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    count_res = await db.execute(count_stmt)
    
    anomalies = result.scalars().all()
    total = count_res.scalar() or 0
    
    return {"success": True, "data": {"items": anomalies, "total": total}}

@router.get("/{id}")
async def get_anomaly(
    id: str,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AnomalyResult).where(AnomalyResult.id == id, AnomalyResult.user_id == current_user.id))
    anomaly = result.scalar_one_or_none()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return {"success": True, "data": AnomalyResponse.model_validate(anomaly)}

@router.put("/{id}")
async def update_anomaly_put(
    id: str,
    update_in: AnomalyStatusUpdate,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AnomalyResult).where(AnomalyResult.id == id, AnomalyResult.user_id == current_user.id))
    anomaly = result.scalar_one_or_none()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    anomaly.status = update_in.status
    if update_in.notes:
        anomaly.notes = update_in.notes
    db.add(anomaly)
    await db.commit()
    await db.refresh(anomaly)
    return {"success": True, "data": AnomalyResponse.model_validate(anomaly)}

@router.patch("/{id}/status")
async def update_anomaly_status(
    id: str,
    update_in: AnomalyStatusUpdate,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """PATCH endpoint used by frontend updateAnomalyStatus()."""
    result = await db.execute(select(AnomalyResult).where(AnomalyResult.id == id, AnomalyResult.user_id == current_user.id))
    anomaly = result.scalar_one_or_none()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    anomaly.status = update_in.status
    if update_in.notes:
        anomaly.notes = update_in.notes
    db.add(anomaly)
    await db.commit()
    await db.refresh(anomaly)
    return {"success": True, "data": AnomalyResponse.model_validate(anomaly)}
