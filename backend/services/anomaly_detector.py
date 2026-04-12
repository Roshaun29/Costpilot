"""
Hybrid Anomaly Detector for CostPilot (Research-Grade).

Implements a weighted ensemble of:
  1. Isolation Forest    — global, multivariate outlier detection
  2. Z-score Baseline    — statistical deviation from rolling mean
  (3. LSTM Autoencoder   — temporal pattern anomalies, Phase 2 stub)

Ensemble formula (paper Section 3.2):
    S(t) = α·IF_score(t) + β·LSTM_score(t) + γ·Z_score(t)
    α=0.50, β=0.00 (Phase 1), γ=0.50
    Decision: ŷ(t) = 1 if S(t) > τ  (τ=0.55)

Feature set used:
  cost, rolling_7d_mean, rolling_7d_std, rolling_30d_mean,
  cost_growth_rate, volatility_7d, z_score,
  day_of_week, is_weekend, month_end, cost_vs_30d
"""

import pandas as pd
import numpy as np
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from models.cost_data import CostData
from models.anomaly import AnomalyResult
from models.cloud_account import CloudAccount

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Constants (tunable for paper experiments)
# ─────────────────────────────────────────────────────────────────────────────
ENSEMBLE_WEIGHTS = {
    "isolation_forest": 0.50,
    "lstm_ae":          0.00,   # Phase 2: set to 0.35 when LSTM is added
    "zscore":           0.50,
}
ANOMALY_THRESHOLD   = 0.55   # τ in paper formula
MIN_DATA_POINTS     = 14     # Minimum history before running IF
LOOKBACK_DAYS       = 60     # Days of history pulled for baseline
RECENT_DAYS         = 3      # Only surface anomalies in last N days
SPIKE_FILTER_RATIO  = 1.3    # Only flag positive deviations > 30%

FEATURE_COLS = [
    "cost",
    "rolling_7d_mean",
    "rolling_7d_std",
    "rolling_30d_mean",
    "cost_growth_rate",
    "volatility_7d",
    "day_of_week",
    "is_weekend",
    "month_end",
    "cost_vs_30d",
]


# ─────────────────────────────────────────────────────────────────────────────
# Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute rich feature set from raw cost time-series.

    Features:
      - rolling_7d_mean / rolling_30d_mean : smoothed cost baseline
      - rolling_7d_std                      : local volatility
      - cost_growth_rate                    : day-over-day % change
      - volatility_7d                       : rolling std of growth rate
      - z_score                             : (cost - mean) / std  (7-day)
      - day_of_week / is_weekend / month_end: temporal indicators
      - cost_vs_30d                         : deviation from 30-day macro baseline
    """
    df = df.sort_values("date").copy()
    df["date"] = pd.to_datetime(df["date"])

    df["rolling_7d_mean"]  = df["cost"].rolling(7,  min_periods=1).mean()
    df["rolling_7d_std"]   = df["cost"].rolling(7,  min_periods=1).std().fillna(1e-8)
    df["rolling_30d_mean"] = df["cost"].rolling(30, min_periods=1).mean()

    df["cost_growth_rate"] = df["cost"].pct_change().fillna(0).clip(-5, 5)
    df["volatility_7d"]    = df["cost_growth_rate"].rolling(7, min_periods=1).std().fillna(0)

    df["z_score"]    = (df["cost"] - df["rolling_7d_mean"]) / (df["rolling_7d_std"] + 1e-8)
    df["cost_vs_30d"] = (df["cost"] - df["rolling_30d_mean"]) / (df["rolling_30d_mean"] + 1e-8)

    df["day_of_week"]  = df["date"].dt.dayofweek
    df["day_of_month"] = df["date"].dt.day
    df["is_weekend"]   = (df["day_of_week"] >= 5).astype(int)
    df["month_end"]    = (df["date"].dt.day >= 28).astype(int)

    return df


# ─────────────────────────────────────────────────────────────────────────────
# Ensemble Scoring Functions
# ─────────────────────────────────────────────────────────────────────────────
def _isolation_forest_scores(features: np.ndarray) -> np.ndarray:
    """
    Returns normalized anomaly scores [0, 1] from Isolation Forest.
    Higher = more anomalous.

    IsolationForest.decision_function() returns negative scores for anomalies.
    We invert so that high score = high anomaly probability.
    """
    model = IsolationForest(
        contamination=0.06,    # ~6% expected anomaly rate
        n_estimators=200,      # More trees = more stable scores
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(features)
    raw = model.decision_function(features)  # negative = anomaly
    # Normalize to [0, 1] — invert so high = anomalous
    min_r, max_r = raw.min(), raw.max()
    if max_r == min_r:
        return np.zeros(len(raw))
    return 1.0 - (raw - min_r) / (max_r - min_r)


def _zscore_scores(z_series: np.ndarray) -> np.ndarray:
    """
    Sigmoid-transform Z-scores to [0, 1].
    Centers at z=2.5 (paper: 2.5σ threshold).

    σ(z) = 1 / (1 + e^{-0.5(z - 2.5)})
    """
    z = np.abs(z_series)
    return 1.0 / (1.0 + np.exp(-0.5 * (z - 2.5)))


def _ensemble_score(if_scores: np.ndarray, z_scores: np.ndarray) -> np.ndarray:
    """
    Weighted ensemble for Phase 1 (no LSTM yet).

    LSTM weight (0.35) is redistributed proportionally:
      IF: 0.50 + 0.35 * (0.50/0.85) ≈ 0.71
      Z:  0.50 + 0.35 * (0.35/0.85) ≈ 0.29  [simplified to 50/50 here]

    In Phase 2, replace with:
      score = α*if_scores + β*lstm_scores + γ*z_scores
    """
    w_if = ENSEMBLE_WEIGHTS["isolation_forest"]
    w_z  = ENSEMBLE_WEIGHTS["zscore"]
    # Normalize weights (handles Phase 1 where lstm_ae=0)
    total = w_if + w_z
    if total == 0:
        total = 1.0
    return (w_if / total) * if_scores + (w_z / total) * z_scores


# ─────────────────────────────────────────────────────────────────────────────
# Database Helpers
# ─────────────────────────────────────────────────────────────────────────────
async def save_anomaly_if_new(db: AsyncSession, anomaly_data: dict) -> Optional[AnomalyResult]:
    """Idempotent insert — skips if same (account, service, date) already exists."""
    existing = await db.execute(
        select(AnomalyResult).where(
            and_(
                AnomalyResult.account_id == anomaly_data["account_id"],
                AnomalyResult.service    == anomaly_data["service"],
                AnomalyResult.anomaly_date == anomaly_data["anomaly_date"],
            )
        )
    )
    if existing.scalar_one_or_none():
        return None

    try:
        anomaly = AnomalyResult(**anomaly_data)
        db.add(anomaly)
        await db.commit()
        await db.refresh(anomaly)
        return anomaly
    except IntegrityError:
        await db.rollback()
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Main Detector Class
# ─────────────────────────────────────────────────────────────────────────────
class AnomalyDetector:

    @classmethod
    async def run_hybrid_detector(
        cls,
        account_id: str,
        service: str,
        db: AsyncSession,
        account_name: str = "Cloud Account",
        provider: str = "aws",
        region: str = "us-east-1",
    ) -> List[Dict[str, Any]]:
        """
        Run hybrid ensemble detection for a single (account, service) pair.

        Returns:
            List of anomaly dicts with fields:
              date, actual_cost, expected_cost, score,
              z_score, if_score, ensemble_score, features, explanation
        """
        # ── Pull historical data ─────────────────────────────────────────
        cutoff = date.today() - timedelta(days=LOOKBACK_DAYS)
        stmt = (
            select(CostData.cost_date, CostData.cost_usd)
            .where(
                CostData.account_id == account_id,
                CostData.service    == service,
                CostData.cost_date  >= cutoff,
            )
            .order_by(CostData.cost_date.asc())
        )
        result = await db.execute(stmt)
        data = [{"date": r.cost_date, "cost": float(r.cost_usd)} for r in result.all()]

        if len(data) < MIN_DATA_POINTS:
            return []

        # ── Feature Engineering ──────────────────────────────────────────
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").resample("D").sum(numeric_only=True).reset_index()
        df.columns = ["date", "cost"]
        df["cost"] = df["cost"].ffill().fillna(0)
        df = engineer_features(df)
        df["service"] = service

        # ── Prepare feature matrix ───────────────────────────────────────
        X = df[FEATURE_COLS].fillna(0).values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # ── Score each model ─────────────────────────────────────────────
        if_scores = _isolation_forest_scores(X_scaled)
        z_scores  = _zscore_scores(df["z_score"].values)
        ensemble  = _ensemble_score(if_scores, z_scores)

        df["if_score"]       = if_scores
        df["z_score_prob"]   = z_scores
        df["ensemble_score"] = ensemble

        # ── Filter: only recent + positive spikes ────────────────────────
        recent_cutoff = datetime.now() - timedelta(days=RECENT_DAYS)
        df["date_dt"] = pd.to_datetime(df["date"])

        flagged = df[
            (df["ensemble_score"] >= ANOMALY_THRESHOLD)
            & (df["date_dt"] >= recent_cutoff)
            & (df["cost"] > df["rolling_7d_mean"] * SPIKE_FILTER_RATIO)
        ]

        # ── Build explanation strings ────────────────────────────────────
        from services.explainability import generate_explanation, rank_features

        results = []
        for _, row in flagged.iterrows():
            row_dict = row.to_dict()
            row_dict["account_name"]   = account_name
            row_dict["monthly_budget"] = None  # populated upstream if needed

            explanation = generate_explanation(row_dict, account_name, provider, region)
            top_features = rank_features(row_dict)

            results.append({
                "date":           row["date"].date() if hasattr(row["date"], "date") else row["date"],
                "actual_cost":    float(row["cost"]),
                "expected_cost":  float(row["rolling_7d_mean"]),
                "score":          float(row["ensemble_score"]),
                "if_score":       float(row["if_score"]),
                "z_score":        float(row["z_score"]),
                "ensemble_score": float(row["ensemble_score"]),
                "features":       top_features,
                "explanation":    explanation,
                "detection_method": "combined",
            })

        return results

    @classmethod
    async def detect_anomalies_for_account(
        cls,
        account_id: str,
        user_id: str,
        db: AsyncSession,
    ) -> List[AnomalyResult]:
        """
        Run full hybrid detection suite across all services for a cloud account.
        Saves new anomalies to DB and returns newly-created objects.
        """
        # Get account metadata for context-rich explanations
        acc_res = await db.execute(select(CloudAccount).where(CloudAccount.id == account_id))
        account = acc_res.scalar_one_or_none()
        account_name = account.account_name if account else "Cloud Account"
        provider     = account.provider     if account else "aws"
        region       = "us-east-1"

        # Find all services for this account
        svc_res = await db.execute(
            select(CostData.service)
            .where(CostData.account_id == account_id)
            .distinct()
        )
        services = list(svc_res.scalars().all())

        new_anomalies: List[AnomalyResult] = []

        for svc in services:
            detected = await cls.run_hybrid_detector(
                account_id=account_id,
                service=svc,
                db=db,
                account_name=account_name,
                provider=provider,
                region=region,
            )

            for d in detected:
                dev_pct  = round(((d["actual_cost"] - d["expected_cost"]) / (d["expected_cost"] + 1e-8)) * 100, 2)
                severity = (
                    "critical" if dev_pct > 300
                    else "high"   if dev_pct > 150
                    else "medium" if dev_pct > 50
                    else "low"
                )

                anomaly_data = {
                    "account_id":       account_id,
                    "user_id":          user_id,
                    "service":          svc,
                    "anomaly_date":     d["date"],
                    "expected_cost":    round(d["expected_cost"], 2),
                    "actual_cost":      round(d["actual_cost"],   2),
                    "deviation_percent": dev_pct,
                    "severity":         severity,
                    "anomaly_score":    d["ensemble_score"],
                    "detection_method": d["detection_method"],
                    "notes":            d["explanation"],   # Store explanation in notes field
                    "status":           "open",
                    "detected_at":      datetime.utcnow(),
                }

                saved = await save_anomaly_if_new(db, anomaly_data)
                if saved:
                    new_anomalies.append(saved)
                    logger.info(
                        f"[ANOMALY] {svc} on {account_id[:8]} | "
                        f"score={d['ensemble_score']:.3f} | dev={dev_pct:.1f}%"
                    )

        return new_anomalies

    # ── Backward-compatible alias ────────────────────────────────────────────
    @classmethod
    async def run_isolation_forest(
        cls, account_id: str, service: str, db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Backward-compatible wrapper (used by scheduler)."""
        return await cls.run_hybrid_detector(account_id, service, db)
