from datetime import datetime, date, timedelta
from sqlalchemy import select, func, delete, insert
from sqlalchemy.ext.asyncio import AsyncSession
from models.cost_data import CostData
from models.anomaly import AnomalyResult
from models.cloud_account import CloudAccount
from models.insight import Insight
from utils.logger import logger

async def generate_insights(user_id: str, db: AsyncSession) -> list:
    """Analyzes recent cost data and anomalies to generate optimization insights."""
    now = datetime.utcnow()
    one_month_ago = date.today() - timedelta(days=30)
    
    # 1. Pull recent anomalies for context
    anoms_stmt = select(AnomalyResult).where(AnomalyResult.user_id == user_id, AnomalyResult.anomaly_date >= one_month_ago).order_by(AnomalyResult.detected_at.desc()).limit(10)
    anoms_res = await db.execute(anoms_stmt)
    anomalies = anoms_res.scalars().all()
    
    # 2. Pull cost data for M-o-M comparison
    mid_month = date.today().replace(day=1)
    prev_month_end = mid_month - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    
    # Fetch current month costs
    curr_stmt = select(CostData.service, CostData.account_id, CostData.cost_usd).where(CostData.user_id == user_id, CostData.cost_date >= mid_month)
    curr_res = await db.execute(curr_stmt)
    curr_rows = curr_res.all()
    
    # Fetch prev month costs
    prev_stmt = select(func.sum(CostData.cost_usd)).where(CostData.user_id == user_id, CostData.cost_date >= prev_month_start, CostData.cost_date <= prev_month_end)
    prev_res = await db.execute(prev_stmt)
    prev_total = prev_res.scalar() or 0.01
    
    curr_total = sum(r.cost_usd for r in curr_rows)
    service_costs = {}
    account_costs = {}
    for r in curr_rows:
        service_costs[r.service] = service_costs.get(r.service, 0) + r.cost_usd
        account_costs[r.account_id] = account_costs.get(r.account_id, 0) + r.cost_usd
        
    top_service = max(service_costs.items(), key=lambda x: x[1])[0] if service_costs else "Cloud Resources"
    top_service_pct = (service_costs[top_service] / curr_total * 100) if curr_total > 0 else 0
    delta = ((curr_total - prev_total) / prev_total * 100)
    
    new_insights = []
    
    # MOM Analysis
    new_insights.append(Insight(
        user_id=user_id,
        insight_type="MOM",
        headline="Month-over-month Spend Analysis",
        body=f"Your total cloud spend {'increased' if delta > 0 else 'decreased'} by {abs(delta):.1f}% compared to last month (₹{curr_total:.2f} vs ₹{prev_total:.2f}). {top_service} was the largest contributor at {top_service_pct:.0f}% of total spend."
    ))
    
    # Budget Projection
    acc_stmt = select(CloudAccount).where(CloudAccount.user_id == user_id)
    acc_res = await db.execute(acc_stmt)
    accounts = acc_res.scalars().all()
    
    days_in_month = calendar_days(date.today().year, date.today().month)
    days_passed = max(1, date.today().day)
    
    for acc in accounts:
        cost_so_far = account_costs.get(acc.id, 0)
        projected = (cost_so_far / days_passed) * days_in_month
        budget = acc.monthly_budget
        overage = ((projected - budget) / budget * 100) if budget > 0 else 0
        
        new_insights.append(Insight(
            user_id=user_id,
            account_id=acc.id,
            insight_type="BUDGET",
            headline=f"Budget Projection: {acc.account_name}",
            body=f"At current spend rate, {acc.account_name} is projected to reach ₹{projected:,.2f} by month-end, which is {abs(overage):.0f}% {'above' if overage > 0 else 'within'} your ₹{budget:,.2f} budget."
        ))
        
    # Anomaly Contextualization — using new Explainability module
    from services.explainability import generate_insight_text
    for a in anomalies:
        if a.deviation_percent and a.deviation_percent > 100:
            new_insights.append(Insight(
                user_id=user_id,
                account_id=a.account_id,
                related_anomaly_id=a.id,
                insight_type="SPIKE",
                headline=f"Cost Spike in {a.service} (+{a.deviation_percent:.0f}%)",
                body=generate_insight_text(
                    service=a.service,
                    curr_total=float(a.actual_cost or 0),
                    prev_total=float(a.expected_cost or 0),
                    provider="Cloud",
                    deviation_percent=float(a.deviation_percent or 0),
                    anomaly_date=a.anomaly_date,
                    account_name=a.account_id[:8],
                )
            ))

    # Clear old and save new
    await db.execute(delete(Insight).where(Insight.user_id == user_id))
    db.add_all(new_insights)
    await db.commit()
    
    return new_insights

def calendar_days(year, month):
    import calendar
    return calendar.monthrange(year, month)[1]
