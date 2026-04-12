"""
AI Explainability Service for CostPilot.

Generates precise, data-driven natural language explanations for
detected anomalies — replacing template strings with feature-driven
analysis.

Paper section: Section 3.4 — Explainability & Triage

Key functions:
  - generate_explanation()  — per-anomaly human-readable text
  - generate_insight_text() — bulk insight from cost trends
  - rank_features()         — returns top contributing features
"""

import pandas as pd
import numpy as np
from datetime import date as date_type
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# Severity labels and emoji maps
# ─────────────────────────────────────────────────────────────────────────────
SEVERITY_EMOJI = {
    "low":      "🟡",
    "medium":   "🟠",
    "high":     "🔴",
    "critical": "🚨",
}

SPIKE_CAUSE_RULES = [
    # (condition_fn, explanation_text)
    (lambda r: r.get("is_weekend") == 1,
     "The anomaly occurred on a weekend — unusual for business workloads. "
     "This may indicate a runaway scheduled job or an unattended deployment."),

    (lambda r: r.get("month_end") == 1,
     "This coincides with the month-end billing cycle. "
     "Verify reserved-instance renewals and automatic scaling policy resets."),

    (lambda r: r.get("cost_growth_rate", 0) > 0.5,
     lambda r: f"Day-over-day cost growth was {r['cost_growth_rate']*100:.1f}%, "
               "indicating a sudden scaling event or a new resource provisioning."),

    (lambda r: r.get("volatility_7d", 0) > 0.25,
     lambda r: f"Cost volatility (7-day) was {r['volatility_7d']*100:.1f}%, "
               "suggesting unstable resource utilization — review auto-scaling thresholds."),

    (lambda r: abs(r.get("z_score", 0)) > 4,
     lambda r: f"The Z-score of {r['z_score']:.1f}σ is extremely high — "
               "indicating a statistical outlier at the 4-sigma level (1-in-16,000 event)."),
]


def _resolve_text(rule_text, row: dict) -> str:
    """Handle both static strings and callables in SPIKE_CAUSE_RULES."""
    if callable(rule_text):
        try:
            return rule_text(row)
        except Exception:
            return ""
    return rule_text


def generate_explanation(
    row: dict,
    account_name: str,
    provider: str,
    region: str = "us-east-1",
) -> str:
    """
    Generate a precise, feature-driven anomaly explanation.

    Args:
        row:          Dict with feature values (from engineered DataFrame)
        account_name: Cloud account display name
        provider:     "aws", "azure", or "gcp"
        region:       Cloud region identifier

    Returns:
        str: Multi-sentence human-readable explanation

    Example output:
        "Cost spike detected in EC2 on 'My AWS Prod' (AWS, us-east-1):
         ₹4,230.00 actual vs ₹1,620.00 expected 7-day average —
         a 161.1% deviation (3.8σ above baseline). Day-over-day cost
         growth was 55.2%, indicating a sudden scaling event."
    """
    service      = row.get("service", "Unknown Service")
    actual       = float(row.get("cost", 0))
    expected     = float(row.get("rolling_7d_mean", actual))
    z_score      = float(row.get("z_score", 0))
    deviation_pct = ((actual - expected) / (expected + 1e-8)) * 100

    # ── Core sentence ──────────────────────────────────────────────────────
    direction = "above" if actual > expected else "below"
    sentences = [
        f"Cost spike detected in {service} on '{account_name}' "
        f"({provider.upper()}, {region}): "
        f"₹{actual:,.2f} actual vs ₹{expected:,.2f} expected 7-day average — "
        f"a {abs(deviation_pct):.1f}% deviation "
        f"({abs(z_score):.1f}σ {direction} baseline)."
    ]

    # ── Context sentences from feature rules ───────────────────────────────
    for condition_fn, explanation_text in SPIKE_CAUSE_RULES:
        try:
            if condition_fn(row):
                sentences.append(_resolve_text(explanation_text, row))
        except Exception:
            continue

    # ── Budget context ─────────────────────────────────────────────────────
    monthly_budget = row.get("monthly_budget")
    if monthly_budget and monthly_budget > 0:
        daily_budget = monthly_budget / 30
        if actual > daily_budget:
            overage = actual - daily_budget
            sentences.append(
                f"This single-day cost exceeds your daily budget allocation "
                f"(₹{daily_budget:,.2f}) by ₹{overage:,.2f}."
            )

    return " ".join(sentences)


def rank_features(row: dict) -> list[dict]:
    """
    Returns a ranked list of features that contributed to the anomaly score.
    Used in the detail panel / paper tables.

    Returns:
        List of dicts: [{feature, value, contribution, direction}]
    """
    contributions = []

    feature_map = {
        "z_score":          {"label": "Z-score (Statistical Deviation)", "weight": 0.25},
        "cost_growth_rate": {"label": "Day-over-Day Growth Rate",        "weight": 0.20},
        "volatility_7d":    {"label": "7-Day Cost Volatility",           "weight": 0.15},
        "cost_vs_30d":      {"label": "Cost vs 30-Day Average",          "weight": 0.15},
        "is_weekend":       {"label": "Weekend Anomaly Indicator",        "weight": 0.10},
        "month_end":        {"label": "Month-End Billing Factor",         "weight": 0.10},
    }

    for feat, meta in feature_map.items():
        raw_val = row.get(feat, 0) or 0
        contribution = abs(float(raw_val)) * meta["weight"]
        contributions.append({
            "feature":      feat,
            "label":        meta["label"],
            "value":        round(float(raw_val), 4),
            "contribution": round(contribution, 4),
            "direction":    "up" if float(raw_val) > 0 else "down",
        })

    contributions.sort(key=lambda x: x["contribution"], reverse=True)
    return contributions


def generate_insight_text(
    service: str,
    curr_total: float,
    prev_total: float,
    provider: str,
    deviation_percent: float,
    anomaly_date,
    account_name: str,
    region: str = "us-east-1",
) -> str:
    """
    Alternative explanation for the Insights page (bulk / non-row-level).
    Compatible with insights_service.py.
    """
    direction = "increased" if curr_total > prev_total else "decreased"
    pct       = abs(deviation_percent)
    return (
        f"{service} costs on '{account_name}' ({provider.upper()}, {region}) "
        f"{direction} by {pct:.1f}% (₹{curr_total:,.2f} actual vs ₹{prev_total:,.2f} expected) "
        f"on {anomaly_date}. "
        f"Consider reviewing recent deployments, scaling events, or configuration changes."
    )
