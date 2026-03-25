from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import boto3
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    NoCredentialsError,
    PartialCredentialsError,
)


class AwsCostServiceError(Exception):
    """Base exception for AWS cost service failures."""


class AwsCredentialsError(AwsCostServiceError):
    """Raised when AWS credentials are missing or incomplete."""


class AwsCostExplorerError(AwsCostServiceError):
    """Raised when the Cost Explorer API returns an error."""


@dataclass
class AwsCostService:
    region_name: str = "us-east-1"
    metric: str = "UnblendedCost"
    _client: Any = field(init=False)

    def __post_init__(self) -> None:
        # Cost Explorer is a global service, but boto3 still expects a region.
        try:
            self._client = boto3.client("ce", region_name=self.region_name)
        except Exception:
            self._client = None

    def fetch_last_30_days_cost(self) -> list[dict[str, Any]]:
        if not self._client:
            raise AwsCredentialsError("AWS client not initialized")

        end_date = date.today()
        start_date = end_date - timedelta(days=30)

        try:
            response = self._client.get_cost_and_usage(
                TimePeriod={
                    "Start": start_date.isoformat(),
                    "End": end_date.isoformat(),
                },
                Granularity="DAILY",
                Metrics=[self.metric],
                GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
            )
        except (NoCredentialsError, PartialCredentialsError) as exc:
            raise AwsCredentialsError(
                "AWS credentials are missing or incomplete. Configure access keys or an IAM role."
            ) from exc
        except (ClientError, BotoCoreError) as exc:
            raise AwsCostExplorerError(
                f"Unable to fetch AWS cost data from Cost Explorer: {exc}"
            ) from exc

        return self._normalize_results(response)

    def _normalize_results(self, response: dict[str, Any]) -> list[dict[str, Any]]:
        results = response.get("ResultsByTime", [])
        if not results:
            return []

        normalized: list[dict[str, Any]] = []

        for time_bucket in results:
            usage_date = time_bucket.get("TimePeriod", {}).get("Start")
            groups = time_bucket.get("Groups", [])

            if not usage_date or not groups:
                continue

            for group in groups:
                keys = group.get("Keys", [])
                amount = group.get("Metrics", {}).get(self.metric, {}).get("Amount")

                if not keys or amount is None:
                    continue

                try:
                    cost_value = float(amount)
                except (TypeError, ValueError):
                    continue

                normalized.append(
                    {
                        "date": usage_date,
                        "service": keys[0],
                        "cost": cost_value,
                        "provider": "aws",
                    }
                )

        return normalized


def get_aws_cost_service(region_name: str = "us-east-1") -> AwsCostService:
    return AwsCostService(region_name=region_name)
