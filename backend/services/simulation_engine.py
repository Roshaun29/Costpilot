import random
import calendar
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from bson import ObjectId

from backend.utils.logger import logger

class SimulationEngine:
    AWS_SERVICES = {
        "EC2": (80.0, 400.0), "RDS": (40.0, 200.0), "S3": (10.0, 80.0),
        "Lambda": (5.0, 50.0), "CloudFront": (15.0, 100.0), "ElastiCache": (20.0, 120.0),
    }
    AZURE_SERVICES = {
        "Virtual Machines": (80.0, 400.0), "Azure SQL": (40.0, 200.0),
        "Blob Storage": (10.0, 80.0), "Functions": (5.0, 50.0), "CDN": (15.0, 100.0),
    }
    GCP_SERVICES = {
        "Compute Engine": (80.0, 400.0), "Cloud SQL": (40.0, 200.0),
        "Cloud Storage": (10.0, 80.0), "Cloud Functions": (5.0, 50.0), "BigQuery": (20.0, 150.0),
    }

    @classmethod
    def get_services(cls, provider: str) -> Dict[str, tuple]:
        provider = (provider or "aws").lower()
        if provider == "azure": return cls.AZURE_SERVICES
        if provider == "gcp": return cls.GCP_SERVICES
        return cls.AWS_SERVICES

    @classmethod
    async def get_account_baselines(cls, account_id: str, provider: str, db) -> Dict[str, float]:
        state = await db.simulation_states.find_one({"account_id": ObjectId(account_id)})
        if state and "baselines" in state.get("engine_state", {}):
            return state["engine_state"]["baselines"]
        
        services = cls.get_services(provider)
        baselines = {}
        for svc, (min_val, max_val) in services.items():
            baselines[svc] = random.uniform(min_val, max_val)
            
        await db.simulation_states.update_one(
            {"account_id": ObjectId(account_id)},
            {"$set": {"engine_state.baselines": baselines}},
            upsert=True
        )
        return baselines

    @classmethod
    def apply_modifiers(cls, base: float, date: datetime, start_date: datetime) -> float:
        # 1. TREND: multiply by (1 + 0.005 * days_since_start)
        days_since_start = max(0, (date - start_date).days)
        cost = base * (1 + 0.005 * days_since_start)
        
        # 2. SEASONALITY
        if date.weekday() < 5:
            cost *= random.uniform(1.0, 1.2)
        else:
            cost *= random.uniform(0.6, 0.8)
            
        # 3. MONTHLY CYCLE
        _, last_day = calendar.monthrange(date.year, date.month)
        if date.day >= last_day - 2:
            cost *= 1.15
            
        # 4. GAUSSIAN NOISE
        noise = np.random.normal(1.0, 0.08)
        cost *= max(0.85, min(1.15, noise))
        
        return cost

    @classmethod
    def _should_inject_anomaly(cls, last_anomaly_date: Optional[datetime], anomaly_type: str, current_date: datetime) -> bool:
        if not last_anomaly_date:
            return True
        days_passed = (current_date - last_anomaly_date).days
        if anomaly_type == "spike" and days_passed >= random.randint(7, 14):
            return True
        elif anomaly_type == "drift" and days_passed >= random.randint(20, 30):
            return True
        elif anomaly_type == "drop" and days_passed >= random.randint(25, 35):
            return True
        return False

    @classmethod
    async def generate_historical_data(cls, account_id: str, user_id: str, provider: str, db) -> int:
        baselines = await cls.get_account_baselines(account_id, provider, db)
        now = datetime.utcnow()
        start = now - timedelta(days=90)
        
        docs = []
        for i in range(90):
            current = start + timedelta(days=i)
            # No anomalies injected in historical data
            for svc, base in baselines.items():
                cost = cls.apply_modifiers(base, current, start)
                docs.append({
                    "account_id": ObjectId(account_id),
                    "user_id": ObjectId(user_id),
                    "date": current,
                    "service": svc,
                    "region": "us-east-1",
                    "cost_usd": round(cost, 2),
                    "usage_quantity": round(cost * random.uniform(0.8, 1.2), 2),
                    "usage_unit": "Hours",
                    "tags": {"environment": "production"},
                    "is_anomaly": False,
                    "created_at": datetime.utcnow()
                })
        
        if docs:
            await db.cost_data.delete_many({"account_id": ObjectId(account_id), "is_anomaly": False})
            await db.cost_data.insert_many(docs)
            logger.info(f"Generated {len(docs)} historical data points for account {account_id}")
            
        return len(docs)

    @classmethod
    async def get_baseline_stats(cls, account_id: str, service: str, db, window_days: int = 30) -> dict:
        cutoff = datetime.utcnow() - timedelta(days=window_days)
        cursor = db.cost_data.find({
            "account_id": ObjectId(account_id),
            "service": service,
            "date": {"$gte": cutoff}
        })
        records = await cursor.to_list(length=None)
        if not records:
            return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0, "p95": 0.0}
        
        costs = [r["cost_usd"] for r in records]
        return {
            "mean": float(np.mean(costs)),
            "std": float(np.std(costs)),
            "min": float(np.min(costs)),
            "max": float(np.max(costs)),
            "p95": float(np.percentile(costs, 95))
        }

    @classmethod
    async def generate_daily_tick(cls, account_id: str, user_id: str, provider: str, db, force_anomaly: str = None) -> list:
        baselines = await cls.get_account_baselines(account_id, provider, db)
        state_doc = await db.simulation_states.find_one({"account_id": ObjectId(account_id)})
        engine_state = state_doc.get("engine_state", {}) if state_doc else {}
        
        start_date = engine_state.get("start_date")
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=90)
        
        current_date = engine_state.get("current_date")
        if current_date:
            current_date += timedelta(days=1)
        else:
            current_date = datetime.utcnow()

        active_drifts = engine_state.get("active_drifts", {})
        last_anomalies = engine_state.get("last_anomalies", {})
        
        services = list(baselines.keys())
        injected = {}
        
        if force_anomaly and force_anomaly in ["spike", "drift", "drop"]:
            svc = random.choice(services)
            injected[svc] = {"type": force_anomaly}
            last_anomalies[force_anomaly] = current_date
            if force_anomaly == "drift":
                active_drifts[svc] = {"start_date": current_date, "days_active": 1, "multiplier": 1.3}
        else:
            for atype in ["spike", "drift", "drop"]:
                last_dt = last_anomalies.get(atype)
                if cls._should_inject_anomaly(last_dt, atype, current_date):
                    svc = random.choice(services)
                    injected[svc] = {"type": atype}
                    last_anomalies[atype] = current_date
                    if atype == "drift":
                        active_drifts[svc] = {"start_date": current_date, "days_active": 1, "multiplier": 1.3}
        
        docs = []
        for svc, base in baselines.items():
            cost = cls.apply_modifiers(base, current_date, start_date)
            is_anomaly = False
            
            # Apply active drift
            if svc in active_drifts:
                drift_info = active_drifts[svc]
                cost *= drift_info["multiplier"]
                drift_info["days_active"] += 1
                drift_info["multiplier"] += 0.3 # increase 30% per day
                is_anomaly = True
                if drift_info["days_active"] > 5:
                    del active_drifts[svc]
            
            # Apply immediate anomalies
            if svc in injected:
                atype = injected[svc]["type"]
                if atype == "spike":
                    cost *= random.uniform(3.0, 8.0)
                    is_anomaly = True
                elif atype == "drop":
                    cost *= random.uniform(0.05, 0.15)
                    is_anomaly = True
            
            doc = {
                "account_id": ObjectId(account_id),
                "user_id": ObjectId(user_id),
                "date": current_date,
                "service": svc,
                "region": "us-east-1",
                "cost_usd": round(cost, 2),
                "usage_quantity": round(cost * random.uniform(0.8, 1.2), 2),
                "usage_unit": "Hours",
                "tags": {"environment": "production"},
                "is_anomaly": is_anomaly,
                "created_at": datetime.utcnow()
            }
            
            await db.cost_data.update_one(
                {"account_id": ObjectId(account_id), "date": current_date, "service": svc},
                {"$set": doc},
                upsert=True
            )
            
            actual_doc = await db.cost_data.find_one({"account_id": ObjectId(account_id), "date": current_date, "service": svc})
            docs.append(actual_doc)
            
        await db.simulation_states.update_one(
            {"account_id": ObjectId(account_id)},
            {"$set": {
                "engine_state.current_date": current_date,
                "engine_state.start_date": start_date,
                "engine_state.last_anomalies": last_anomalies,
                "engine_state.active_drifts": active_drifts
            }},
            upsert=True
        )
        return docs
