from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd


REQUIRED_COLUMNS = ["date", "service", "cost"]


class DataProcessingError(Exception):
    """Raised when raw cloud cost data cannot be processed."""


@dataclass
class CloudCostDataProcessor:
    normalize_cost: bool = True

    def process(self, raw_data: list[dict[str, Any]]) -> pd.DataFrame:
        dataframe = self._build_dataframe(raw_data)
        dataframe = self._clean_dataframe(dataframe)
        dataframe = self._group_by_service(dataframe)

        if self.normalize_cost:
            dataframe = self._normalize_cost_column(dataframe)

        return dataframe

    def _build_dataframe(self, raw_data: list[dict[str, Any]]) -> pd.DataFrame:
        if not raw_data:
            return self._empty_dataframe()

        dataframe = pd.DataFrame(raw_data)
        missing_columns = [column for column in REQUIRED_COLUMNS if column not in dataframe.columns]
        if missing_columns:
            missing = ", ".join(missing_columns)
            raise DataProcessingError(f"Missing required columns in raw data: {missing}")

        return dataframe[REQUIRED_COLUMNS].copy()

    def _clean_dataframe(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        if dataframe.empty:
            return self._empty_dataframe()

        dataframe["date"] = pd.to_datetime(dataframe["date"], errors="coerce")
        dataframe["service"] = dataframe["service"].astype("string").str.strip()
        dataframe["cost"] = pd.to_numeric(dataframe["cost"], errors="coerce")

        dataframe = dataframe.dropna(subset=["date", "service", "cost"])
        dataframe = dataframe[dataframe["service"] != ""]
        dataframe = dataframe.sort_values("date").reset_index(drop=True)

        return dataframe

    def _group_by_service(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        if dataframe.empty:
            return self._empty_dataframe()

        grouped = (
            dataframe.groupby(["date", "service"], as_index=False)["cost"]
            .sum()
            .sort_values(["date", "service"])
            .reset_index(drop=True)
        )
        return grouped

    def _normalize_cost_column(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        if dataframe.empty:
            return self._empty_dataframe()

        min_cost = dataframe["cost"].min()
        max_cost = dataframe["cost"].max()

        if pd.isna(min_cost) or pd.isna(max_cost):
            dataframe["cost"] = dataframe["cost"].astype(float)
            return dataframe

        if min_cost == max_cost:
            dataframe["cost"] = 0.0
            return dataframe

        dataframe["cost"] = ((dataframe["cost"] - min_cost) / (max_cost - min_cost)).astype(float)
        return dataframe

    def _empty_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(
            {
                "date": pd.Series(dtype="datetime64[ns]"),
                "service": pd.Series(dtype="string"),
                "cost": pd.Series(dtype="float64"),
            }
        )


def get_cloud_cost_data_processor(normalize_cost: bool = True) -> CloudCostDataProcessor:
    return CloudCostDataProcessor(normalize_cost=normalize_cost)
