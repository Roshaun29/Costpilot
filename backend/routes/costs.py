from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, distinct
from db.mysql import get_db
from models.cost_data import CostData, CostDataResponse
from models.user import User
from utils.jwt_utils import get_current_user
from typing import List, Optional
from datetime import date, datetime, timedelta
import pandas as pd
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/summary")
async def get_summary(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Must be before parameterized routes to avoid conflicts."""
    mid_month = date.today().replace(day=1)
    
    # Current month total
    res = await db.execute(
        select(func.sum(CostData.cost_usd)).where(
            CostData.user_id == current_user.id,
            CostData.cost_date >= mid_month
        )
    )
    curr_total = res.scalar() or 0.0
    
    # prev month total
    prev_month_end = mid_month - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    
    res = await db.execute(
        select(func.sum(CostData.cost_usd)).where(
            CostData.user_id == current_user.id,
            CostData.cost_date >= prev_month_start,
            CostData.cost_date <= prev_month_end
        )
    )
    prev_total = res.scalar() or 0.0
    
    delta = 0.0
    if prev_total > 0:
        delta = ((curr_total - prev_total) / prev_total) * 100
    
    # Days projection
    import calendar
    today = date.today()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_passed = max(1, today.day)
    projected = (curr_total / days_passed) * days_in_month if days_passed > 0 else curr_total
        
    # top services
    res = await db.execute(
        select(CostData.service, func.sum(CostData.cost_usd).label("cost")).where(
            CostData.user_id == current_user.id,
            CostData.cost_date >= mid_month
        ).group_by(CostData.service).order_by(func.sum(CostData.cost_usd).desc()).limit(5)
    )
    top_services = [{"service": r.service, "cost": r.cost} for r in res.all()]
    
    return {
        "success": True, 
        "data": {
            "current_month_total": round(curr_total, 2),
            "previous_month_total": round(prev_total, 2),
            "delta_percent": round(delta, 2),
            "top_services": top_services,
            "projected_month_end": round(projected, 2)
        }
    }

@router.get("/services")
async def get_services(
    account_id: Optional[str] = None,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """Get list of unique services for the user (used by CostExplorer filter)."""
    stmt = select(distinct(CostData.service)).where(CostData.user_id == current_user.id)
    if account_id:
        stmt = stmt.where(CostData.account_id == account_id)
    result = await db.execute(stmt)
    services = [r[0] for r in result.all()]
    return {"success": True, "data": services}


@router.get("/forecast")
async def get_cost_forecast(
    account_id: Optional[str] = None,
    days:       int = Query(7, description="Forecast horizon in days"),
    window:     int = Query(60, description="Historical lookback window in days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return 7-day Holt-Winters cost forecast with confidence intervals
    and rolling average curve (used by CostLineChart dashboard).

    Response fields:
      - history       : list of {date, cost, rolling_mean, bollinger_upper, bollinger_lower}
      - forecast      : list of {date, value, lower, upper}
    """
    from services.time_series_model import TimeSeriesAnalyzer
    analyzer = TimeSeriesAnalyzer()

    cutoff = date.today() - timedelta(days=window)

    stmt = (
        select(CostData.cost_date, func.sum(CostData.cost_usd).label("total_cost"))
        .where(
            CostData.user_id   == current_user.id,
            CostData.cost_date >= cutoff,
        )
    )
    if account_id:
        stmt = stmt.where(CostData.account_id == account_id)
    stmt = stmt.group_by(CostData.cost_date).order_by(CostData.cost_date.asc())

    result = await db.execute(stmt)
    rows   = result.all()

    if not rows:
        return {"success": True, "data": {"history": [], "forecast": []}}

    df = pd.DataFrame({"date": [r.cost_date for r in rows], "cost": [float(r.total_cost) for r in rows]})
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").resample("D").sum(numeric_only=True).reset_index()
    df.columns = ["date", "cost"]

    # Rolling statistics (Bollinger bands)
    df = analyzer.rolling_stats(df, window=7)

    # Forecast
    series = df.set_index("date")["cost"]
    forecast_result = analyzer.forecast(series, steps=days)

    history = [
        {
            "date":             d.strftime("%Y-%m-%d"),
            "cost":             round(float(c), 2),
            "rolling_mean":     round(float(rm) if rm == rm else 0, 2),
            "bollinger_upper":  round(float(bu) if bu == bu else 0, 2),
            "bollinger_lower":  round(float(bl) if bl == bl else 0, 2),
        }
        for d, c, rm, bu, bl in zip(
            df["date"], df["cost"],
            df["rolling_mean"], df["bollinger_upper"], df["bollinger_lower"]
        )
    ]

    forecast = [
        {
            "date":  d,
            "value": v,
            "lower": lo,
            "upper": hi,
        }
        for d, v, lo, hi in zip(
            forecast_result["dates"],
            forecast_result["forecast"],
            forecast_result["lower"],
            forecast_result["upper"],
        )
    ]

    return {
        "success": True,
        "data": {
            "history":  history,
            "forecast": forecast,
            "method":   forecast_result.get("method", "holt_winters"),
        }
    }


@router.get("")
async def get_costs(
    account_id: Optional[str] = None,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    granularity: str = Query("daily"),
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CostData).where(
        CostData.user_id == current_user.id
    )
    if account_id:
        stmt = stmt.where(CostData.account_id == account_id)
    
    if start_date:
        stmt = stmt.where(CostData.cost_date >= start_date)
    if end_date:
        stmt = stmt.where(CostData.cost_date <= end_date)
        
    stmt = stmt.order_by(CostData.cost_date.asc())
        
    result = await db.execute(stmt)
    costs = result.scalars().all()
    
    return {"success": True, "data": costs}
