from datetime import datetime, timedelta
from bson import ObjectId
from backend.utils.logger import logger

async def generate_insights(user_id: str, db) -> list:
    uid = ObjectId(user_id)
    now = datetime.utcnow()
    
    anomalies = await db.anomalies.aggregate([
        {"$match": {"user_id": uid, "anomaly_date": {"$gte": now - timedelta(days=30)}}},
        {"$sort": {"anomaly_date": -1}},
        {"$limit": 10},
        {"$lookup": {"from": "cloud_accounts", "localField": "account_id", "foreignField": "_id", "as": "acc"}},
        {"$unwind": {"path": "$acc", "preserveNullAndEmptyArrays": True}}
    ]).to_list(None)
    
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if current_month_start.month == 1:
        prev_month_start = current_month_start.replace(year=current_month_start.year - 1, month=12)
    else:
        prev_month_start = current_month_start.replace(month=current_month_start.month - 1)
    
    curr_docs = await db.cost_data.find({"user_id": uid, "date": {"$gte": current_month_start}}).to_list(None)
    prev_docs = await db.cost_data.find({"user_id": uid, "date": {"$gte": prev_month_start, "$lt": current_month_start}}).to_list(None)
    
    curr_total = sum(d["cost_usd"] for d in curr_docs)
    prev_total = sum(d["cost_usd"] for d in prev_docs)
    
    service_costs = {}
    account_costs = {}
    for d in curr_docs:
        service_costs[d["service"]] = service_costs.get(d["service"], 0) + d["cost_usd"]
        account_costs[d["account_id"]] = account_costs.get(d["account_id"], 0) + d["cost_usd"]
        
    top_service = max(service_costs.items(), key=lambda x: x[1])[0] if service_costs else "Unknown"
    top_service_pct = (service_costs[top_service] / curr_total * 100) if curr_total > 0 else 0
    delta = ((curr_total - prev_total) / prev_total * 100) if prev_total > 0 else 0
    
    accounts = await db.cloud_accounts.find({"user_id": uid}).to_list(None)
    
    new_insights = []
    
    new_insights.append({
        "type": "MOM",
        "headline": "Month-over-month Spend Analysis",
        "body": f"Your total cloud spend {'increased' if delta > 0 else 'decreased'} by {abs(delta):.1f}% compared to last month (${curr_total:.2f} vs ${prev_total:.2f}). {top_service} was the largest contributor at {top_service_pct:.0f}% of total spend.",
        "user_id": uid,
        "created_at": now
    })
    
    days_in_month = (current_month_start.replace(month=current_month_start.month % 12 + 1, day=1) - timedelta(days=1)).day
    days_passed = max(1, now.day)
    for acc in accounts:
        aid = acc["_id"]
        budget = acc.get("monthly_budget", 5000)
        cost_so_far = account_costs.get(aid, 0)
        projected = (cost_so_far / days_passed) * days_in_month
        overage = ((projected - budget) / budget * 100) if budget > 0 else 0
        
        new_insights.append({
            "type": "BUDGET",
            "headline": f"Budget Projection: {acc.get('account_name', 'Account')}",
            "body": f"At current spend rate, {acc.get('account_name', 'Account')} is projected to reach ${projected:.2f} by month-end, which is {abs(overage):.0f}% {'above' if overage > 0 else 'within'} your ${budget:.2f} budget.",
            "user_id": uid,
            "account_id": aid,
            "created_at": now
        })
        
    for a in anomalies:
        acc_name = a.get("acc", {}).get("account_name", "Unknown Account")
        if a["detection_method"] in ["isolation_forest", "zscore", "combined"] and a["deviation_percent"] > 100:
            new_insights.append({
                "type": "SPIKE",
                "headline": f"Cost Spike in {a['service']}",
                "body": f"Your {a['service']} costs on {acc_name} spiked {a['deviation_percent']:.0f}% above the 30-day baseline on {a['anomaly_date'].strftime('%Y-%m-%d')}. Actual spend was ${a['actual_cost']:.2f} vs expected ${a['expected_cost']:.2f}. Consider reviewing recent deployments or auto-scaling configurations.",
                "user_id": uid,
                "account_id": a["account_id"],
                "related_anomaly_id": a["_id"],
                "created_at": now
            })
        elif a["deviation_percent"] > 0:
            new_insights.append({
                "type": "DRIFT",
                "headline": f"Cost Drift in {a['service']}",
                "body": f"A gradual cost drift has been detected in {a['service']} over the past 5 days with a cumulative increase of {a['deviation_percent']:.0f}%. This pattern often indicates uncleaned resources or increased traffic. Recommended: audit active instances.",
                "user_id": uid,
                "account_id": a["account_id"],
                "related_anomaly_id": a["_id"],
                "created_at": now
            })
            
    await db.insights.delete_many({"user_id": uid})
    if new_insights:
        await db.insights.insert_many(new_insights)
    
    return sorted(new_insights, key=lambda x: getattr(x, 'created_at', now), reverse=True)[:10]
