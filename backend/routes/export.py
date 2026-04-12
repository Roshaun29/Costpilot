"""
Dataset Export + Model Evaluation Routes for CostPilot.

Provides:
  GET  /api/export/dataset   — Export labeled cost dataset (CSV/JSON)
  GET  /api/export/evaluate  — Compute Precision, Recall, F1 on simulation labels

These endpoints are paper-ready and meant for research reproducibility.

Paper Section 4: Evaluation
  Precision = TP / (TP + FP)
  Recall    = TP / (TP + FN)
  F1        = 2 × P × R / (P + R)
"""

import io
import csv
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.mysql import get_db
from models.cost_data import CostData
from models.anomaly import AnomalyResult
from models.cloud_account import CloudAccount
from models.user import User
from utils.jwt_utils import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

INR_RATE = 83.50   # 1 USD = ₹83.50


# ─────────────────────────────────────────────────────────────────────────────
# Dataset Export
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/dataset")
async def export_dataset(
    format: str = Query("csv", description="Output format: 'csv' or 'json'"),
    days:   int = Query(90,    description="Number of past days to export"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export labeled anomaly dataset for research publication.

    Column schema:
        timestamp  : ISO 8601 date (YYYY-MM-DD)
        service    : Cloud service name (EC2, S3, Lambda, …)
        region     : Cloud region (us-east-1, …)
        cost_usd   : Daily cost in USD
        cost_inr   : Daily cost in INR (×83.50)
        anomaly_label : 1 = anomaly injected, 0 = normal
        provider   : aws | azure | gcp
        account_name: Account display name
    """
    cutoff = date.today() - timedelta(days=days)

    stmt = (
        select(
            CostData.cost_date,
            CostData.service,
            CostData.region,
            CostData.cost_usd,
            CostData.is_anomaly,
            CloudAccount.provider,
            CloudAccount.account_name,
        )
        .join(CloudAccount, CostData.account_id == CloudAccount.id)
        .where(
            CostData.user_id == current_user.id,
            CostData.cost_date >= cutoff,
        )
        .order_by(CostData.cost_date.asc(), CostData.service.asc())
    )

    result = await db.execute(stmt)
    rows   = result.all()

    if not rows:
        return {"success": True, "data": [], "count": 0, "message": "No data found for this date range."}

    if format.lower() == "json":
        data = [
            {
                "timestamp":     r.cost_date.isoformat(),
                "service":       r.service,
                "region":        r.region or "us-east-1",
                "cost_usd":      round(float(r.cost_usd), 4),
                "cost_inr":      round(float(r.cost_usd) * INR_RATE, 2),
                "anomaly_label": int(r.is_anomaly or 0),
                "provider":      r.provider,
                "account_name":  r.account_name,
            }
            for r in rows
        ]
        return {
            "success": True,
            "count":   len(data),
            "schema":  "timestamp,service,region,cost_usd,cost_inr,anomaly_label,provider,account_name",
            "data":    data,
        }

    # ── CSV streaming response ────────────────────────────────────────────
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "service", "region", "cost_usd", "cost_inr", "anomaly_label", "provider", "account_name"])
    for r in rows:
        writer.writerow([
            r.cost_date.isoformat(),
            r.service,
            r.region or "us-east-1",
            round(float(r.cost_usd), 4),
            round(float(r.cost_usd) * INR_RATE, 2),
            int(r.is_anomaly or 0),
            r.provider,
            r.account_name,
        ])

    output.seek(0)
    filename = f"costpilot_dataset_{date.today()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Model Evaluation (Precision / Recall / F1)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/evaluate")
async def evaluate_model(
    days:    int = Query(90, description="Evaluation window in days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compute classification metrics by cross-referencing:
      - Ground truth  : CostData.is_anomaly (injected by simulation engine)
      - Model output  : AnomalyResult records (detected by hybrid ensemble)

    Paper section 4 — Evaluation Metrics table.
    """
    cutoff = date.today() - timedelta(days=days)

    # ── Pull ground truth from cost_data ─────────────────────────────────
    gt_stmt = select(
        CostData.cost_date,
        CostData.service,
        CostData.account_id,
        CostData.is_anomaly,
    ).where(
        CostData.user_id   == current_user.id,
        CostData.cost_date >= cutoff,
    )
    gt_res  = await db.execute(gt_stmt)
    gt_rows = gt_res.all()

    # ── Pull model detections from anomaly_results ───────────────────────
    det_stmt = select(
        AnomalyResult.anomaly_date,
        AnomalyResult.service,
        AnomalyResult.account_id,
    ).where(
        AnomalyResult.user_id      == current_user.id,
        AnomalyResult.anomaly_date >= cutoff,
    )
    det_res  = await db.execute(det_stmt)
    det_rows = det_res.all()

    # Build fast lookup set for model detections
    detected_keys = {
        (str(r.anomaly_date), r.service, r.account_id)
        for r in det_rows
    }

    # ── Compute confusion matrix ─────────────────────────────────────────
    TP = FP = FN = TN = 0

    for row in gt_rows:
        key     = (str(row.cost_date), row.service, row.account_id)
        gt_anom = bool(row.is_anomaly)
        pred    = key in detected_keys

        if gt_anom and pred:
            TP += 1
        elif not gt_anom and pred:
            FP += 1
        elif gt_anom and not pred:
            FN += 1
        else:
            TN += 1

    # ── Metrics ──────────────────────────────────────────────────────────
    precision = TP / (TP + FP) if (TP + FP) > 0 else 0.0
    recall    = TP / (TP + FN) if (TP + FN) > 0 else 0.0
    f1        = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    fpr       = FP / (FP + TN) if (FP + TN) > 0 else 0.0  # False Positive Rate

    total_gt_anomalies = TP + FN
    total_normal       = FP + TN
    total_evaluated    = len(gt_rows)

    return {
        "success": True,
        "data": {
            "metrics": {
                "precision":          round(precision, 4),
                "recall":             round(recall,    4),
                "f1_score":           round(f1,        4),
                "false_positive_rate": round(fpr,      4),
            },
            "confusion_matrix": {
                "true_positive":  TP,
                "false_positive": FP,
                "false_negative": FN,
                "true_negative":  TN,
            },
            "summary": {
                "total_evaluated":      total_evaluated,
                "total_gt_anomalies":   total_gt_anomalies,
                "total_normal":         total_normal,
                "total_detected":       len(detected_keys),
                "evaluation_window_days": days,
            },
            "notes": {
                "ground_truth":        "CostData.is_anomaly flag set by simulation engine at data generation time",
                "model_output":        "AnomalyResult rows created by hybrid Isolation Forest + Z-score ensemble",
                "detection_method":    "combined (IF + Z-score, Phase 1)",
                "ensemble_weights":    {"isolation_forest": 0.50, "zscore": 0.50, "lstm_ae": 0.00},
                "anomaly_threshold":   0.55,
            }
        }
    }
