from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from db.mysql import get_db
from models.insight import Insight, InsightResponse
from models.user import User
from utils.jwt_utils import get_current_user
from utils.response import success_response
from services.insights_service import generate_insights

router = APIRouter(tags=["insights"])

@router.get("", response_model=None)
async def get_insights(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    uid = current_user.id
    
    # Check if we have recent insights
    stmt = select(Insight).where(Insight.user_id == uid).order_by(desc(Insight.created_at)).limit(10)
    res = await db.execute(stmt)
    items = res.scalars().all()
    
    if not items:
        items = await generate_insights(uid, db)
    
    return success_response(items)

@router.post("/generate")
async def manual_generate(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    uid = current_user.id
    items = await generate_insights(uid, db)
    return success_response(items, "Insights generated successfully")
