import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from bson import ObjectId
from sklearn.ensemble import IsolationForest
from scipy.stats import zscore

from backend.utils.logger import logger
from backend.services.alert_service import evaluate_rules_for_anomaly

class AnomalyDetector:

    @classmethod
    async def run_isolation_forest(cls, account_id: str, service: str, db) -> List[Dict[str, Any]]:
        cutoff = datetime.utcnow() - timedelta(days=60)
        cursor = db.cost_data.find(
            {"account_id": ObjectId(account_id), "service": service, "date": {"$gte": cutoff}},
            {"date": 1, "cost_usd": 1}
        ).sort("date", 1)
        data = await cursor.to_list(length=None)
        
        if len(data) < 14:
            return []
            
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        # Ensure daily data structure for rolling window calculation
        df = df.set_index('date').resample('1D').sum().reset_index()
        # forward fill any missing gaps safely
        df['cost_usd'] = df['cost_usd'].ffill().fillna(0)
        
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        df['rolling_7d_mean'] = df['cost_usd'].rolling(7, min_periods=1).mean()
        df['rolling_7d_std'] = df['cost_usd'].rolling(7, min_periods=1).std().fillna(0)
        
        features = df[['cost_usd', 'day_of_week', 'day_of_month', 'rolling_7d_mean', 'rolling_7d_std']].values
        
        model = IsolationForest(contamination=0.05, random_state=42)
        df['anomaly'] = model.fit_predict(features)
        df['score'] = model.decision_function(features)
        
        last_7_days = df.iloc[-7:]
        anomalies = last_7_days[last_7_days['anomaly'] == -1]
        
        results = []
        for _, row in anomalies.iterrows():
            results.append({
                "date": row['date'],
                "actual_cost": row['cost_usd'],
                "expected_cost": row['rolling_7d_mean'],
                "score": float(row['score'])
            })
        return results

    @classmethod
    async def run_zscore(cls, account_id: str, service: str, db) -> List[Dict[str, Any]]:
        cutoff = datetime.utcnow() - timedelta(days=30)
        cursor = db.cost_data.find(
            {"account_id": ObjectId(account_id), "service": service, "date": {"$gte": cutoff}},
            {"date": 1, "cost_usd": 1}
        ).sort("date", 1)
        data = await cursor.to_list(length=None)
        
        if len(data) < 7:
            return []
            
        df = pd.DataFrame(data)
        df['cost_usd'] = df['cost_usd'].astype(float)
        
        mean = df['cost_usd'].mean()
        std = df['cost_usd'].std()
        if std == 0:
            return []
            
        df['zscore'] = (df['cost_usd'] - mean) / std
        anomalies = df[df['zscore'].abs() > 2.5]
        
        results = []
        for _, row in anomalies.iterrows():
            results.append({
                "date": row['date'],
                "actual_cost": row['cost_usd'],
                "expected_cost": mean,
                "score": float(row['zscore'])
            })
        return results

    @classmethod
    async def detect_anomalies_for_account(cls, account_id: str, user_id: str, db) -> List[Dict[str, Any]]:
        pipeline = [
            {"$match": {"account_id": ObjectId(account_id)}},
            {"$group": {"_id": "$service"}}
        ]
        services_data = await db.cost_data.aggregate(pipeline).to_list(length=None)
        services = [s["_id"] for s in services_data]
        
        new_anomalies = []
        
        for svc in services:
            if_results = await cls.run_isolation_forest(account_id, svc, db)
            z_results = await cls.run_zscore(account_id, svc, db)
            
            if_map = {r["date"].strftime("%Y-%m-%d"): r for r in if_results}
            z_map = {r["date"].strftime("%Y-%m-%d"): r for r in z_results}
            
            all_dates = set(if_map.keys()).union(set(z_map.keys()))
            
            for dt_str in all_dates:
                if_res = if_map.get(dt_str)
                z_res = z_map.get(dt_str)
                
                method = "combined" if (if_res and z_res) else ("isolation_forest" if if_res else "zscore")
                
                base_res = if_res or z_res
                actual_cost = base_res["actual_cost"]
                expected_cost = max(base_res["expected_cost"], 0.01)
                
                dev_pct = ((actual_cost - expected_cost) / expected_cost) * 100
                
                if dev_pct > 200:
                    severity = "critical"
                elif dev_pct > 100:
                    severity = "high"
                elif dev_pct > 50:
                    severity = "medium"
                else:
                    severity = "low"
                    
                anomaly_date = base_res["date"]
                
                dup = await db.anomalies.find_one({
                    "account_id": ObjectId(account_id),
                    "service": svc,
                    "anomaly_date": anomaly_date
                })
                
                if not dup:
                    doc = {
                        "account_id": ObjectId(account_id),
                        "user_id": ObjectId(user_id),
                        "detected_at": datetime.utcnow(),
                        "service": svc,
                        "anomaly_date": anomaly_date,
                        "expected_cost": round(expected_cost, 2),
                        "actual_cost": round(actual_cost, 2),
                        "deviation_percent": round(dev_pct, 2),
                        "severity": severity,
                        "detection_method": method,
                        "anomaly_score": round(base_res["score"], 4),
                        "status": "open",
                        "notes": None,
                        "created_at": datetime.utcnow()
                    }
                    res = await db.anomalies.insert_one(doc)
                    doc["_id"] = res.inserted_id
                    new_anomalies.append(doc)
                    
                    try:
                        await evaluate_rules_for_anomaly(doc, db)
                    except Exception as e:
                        logger.error(f"Error triggering alert service: {e}")
                        
        return new_anomalies
