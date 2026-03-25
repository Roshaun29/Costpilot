from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd
from sklearn.ensemble import IsolationForest


REQUIRED_COLUMNS = ["date", "service", "cost"]


class AnomalyDetectionError(Exception):
    """Raised when anomaly detection cannot be performed."""


@dataclass
class CloudCostAnomalyDetector:
    contamination: float = 0.1
    zscore_threshold: float = 2.5
    min_samples_per_service: int = 5
    random_state: int = 42

    def detect(self, data: pd.DataFrame | list[dict[str, Any]]) -> pd.DataFrame:
        dataframe = self._prepare_dataframe(data)
        if dataframe.empty:
            return self._empty_result()

        results = []
        for _, service_frame in dataframe.groupby("service", sort=False):
            results.append(self._detect_for_service(service_frame.copy()))

        detected = pd.concat(results, ignore_index=True) if results else self._empty_result()
        return detected.sort_values(["date", "service"]).reset_index(drop=True)

    def _prepare_dataframe(self, data: pd.DataFrame | list[dict[str, Any]]) -> pd.DataFrame:
        if isinstance(data, pd.DataFrame):
            dataframe = data.copy()
        else:
            dataframe = pd.DataFrame(data)

        if dataframe.empty:
            return pd.DataFrame(columns=REQUIRED_COLUMNS)

        missing_columns = [column for column in REQUIRED_COLUMNS if column not in dataframe.columns]
        if missing_columns:
            missing = ", ".join(missing_columns)
            raise AnomalyDetectionError(f"Missing required columns for anomaly detection: {missing}")

        dataframe = dataframe[REQUIRED_COLUMNS].copy()
        dataframe["date"] = pd.to_datetime(dataframe["date"], errors="coerce")
        dataframe["service"] = dataframe["service"].astype("string").str.strip()
        dataframe["cost"] = pd.to_numeric(dataframe["cost"], errors="coerce")
        dataframe = dataframe.dropna(subset=["date", "service", "cost"])
        dataframe = dataframe[dataframe["service"] != ""]
        dataframe = dataframe.sort_values(["service", "date"]).reset_index(drop=True)
        return dataframe

    def _detect_for_service(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        dataframe = dataframe.sort_values("date").reset_index(drop=True)
        dataframe["z_score"] = self._compute_z_score(dataframe["cost"])
        dataframe["anomaly_score"] = self._compute_isolation_scores(dataframe)
        dataframe["isolation_anomaly"] = dataframe["anomaly_score"] >= 0.5
        dataframe["zscore_anomaly"] = dataframe["z_score"].abs() >= self.zscore_threshold
        dataframe["is_anomaly"] = dataframe["isolation_anomaly"] | dataframe["zscore_anomaly"]
        dataframe["explanation"] = dataframe.apply(self._build_explanation, axis=1)

        return dataframe[
            ["date", "service", "cost", "anomaly_score", "is_anomaly", "explanation"]
        ]

    def _compute_z_score(self, cost_series: pd.Series) -> pd.Series:
        std_dev = cost_series.std(ddof=0)
        if pd.isna(std_dev) or std_dev == 0:
            return pd.Series(0.0, index=cost_series.index, dtype="float64")
        mean_value = cost_series.mean()
        return ((cost_series - mean_value) / std_dev).astype(float)

    def _compute_isolation_scores(self, dataframe: pd.DataFrame) -> pd.Series:
        if len(dataframe) < self.min_samples_per_service:
            return self._scaled_cost_delta(dataframe["cost"])

        features = pd.DataFrame(
            {
                "cost": dataframe["cost"].astype(float),
                "day_index": (dataframe["date"] - dataframe["date"].min()).dt.days.astype(float),
            }
        )
        contamination = min(max(self.contamination, 0.001), 0.5)
        model = IsolationForest(
            contamination=contamination,
            random_state=self.random_state,
            n_estimators=200,
            n_jobs=-1,
        )
        model.fit(features)

        raw_scores = -model.score_samples(features)
        min_score = float(raw_scores.min())
        max_score = float(raw_scores.max())
        if max_score == min_score:
            return pd.Series(0.0, index=dataframe.index, dtype="float64")
        normalized_scores = (raw_scores - min_score) / (max_score - min_score)
        return pd.Series(normalized_scores, index=dataframe.index, dtype="float64")

    def _scaled_cost_delta(self, cost_series: pd.Series) -> pd.Series:
        rolling_baseline = cost_series.expanding().mean().shift(1).fillna(cost_series)
        delta = (cost_series - rolling_baseline).abs()
        max_delta = float(delta.max()) if not delta.empty else 0.0
        if max_delta == 0:
            return pd.Series(0.0, index=cost_series.index, dtype="float64")
        return (delta / max_delta).astype(float)

    def _build_explanation(self, row: pd.Series) -> str:
        if not bool(row["is_anomaly"]):
            return "No significant spike detected"

        if bool(row["zscore_anomaly"]) and row["z_score"] > 0:
            return "Cost spike detected versus the service baseline"
        if bool(row["zscore_anomaly"]) and row["z_score"] < 0:
            return "Cost drop detected versus the service baseline"
        if bool(row["isolation_anomaly"]):
            return "Isolation Forest flagged this point as unusual for the service trend"
        return "Anomalous cost pattern detected"

    def _empty_result(self) -> pd.DataFrame:
        return pd.DataFrame(
            {
                "date": pd.Series(dtype="datetime64[ns]"),
                "service": pd.Series(dtype="string"),
                "cost": pd.Series(dtype="float64"),
                "anomaly_score": pd.Series(dtype="float64"),
                "is_anomaly": pd.Series(dtype="bool"),
                "explanation": pd.Series(dtype="string"),
            }
        )


def get_cloud_cost_anomaly_detector(
    contamination: float = 0.1,
    zscore_threshold: float = 2.5,
    min_samples_per_service: int = 5,
) -> CloudCostAnomalyDetector:
    return CloudCostAnomalyDetector(
        contamination=contamination,
        zscore_threshold=zscore_threshold,
        min_samples_per_service=min_samples_per_service,
    )
