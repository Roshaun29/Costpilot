from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from config import Settings, get_settings
from db.connection import get_anomaly_results_collection
from models.anomaly import build_anomaly_result_document
from routes.auth import get_current_user
from services.anomaly_detector import (
    AnomalyDetectionError,
    CloudCostAnomalyDetector,
    get_cloud_cost_anomaly_detector,
)
from services.aws_service import AwsCostExplorerError, AwsCredentialsError, AwsCostService
from services.data_processor import (
    CloudCostDataProcessor,
    DataProcessingError,
    get_cloud_cost_data_processor,
)
from services.simulator_service import SimulatorService


router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])

SIMULATED_PROVIDER_MAP = {
    "simulated": "aws",
    "aws_simulated": "aws",
    "azure_simulated": "azure",
    "gcp_simulated": "gcp",
}


def get_aws_service(settings: Settings = Depends(get_settings)) -> AwsCostService:
    from services.aws_service import get_aws_cost_service

    return get_aws_cost_service(region_name=settings.aws_region)


def get_anomaly_detector(
    settings: Settings = Depends(get_settings),
) -> CloudCostAnomalyDetector:
    return get_cloud_cost_anomaly_detector(
        contamination=settings.anomaly_contamination,
        zscore_threshold=settings.anomaly_zscore_threshold,
        min_samples_per_service=settings.anomaly_min_samples_per_service,
    )


def get_anomaly_data_processor() -> CloudCostDataProcessor:
    return get_cloud_cost_data_processor(normalize_cost=False)


def get_simulator_service() -> SimulatorService:
    return SimulatorService()


def _serialize_anomalies(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for record in records:
        serialized.append(
            {
                "date": (
                    record["date"].isoformat()
                    if hasattr(record["date"], "isoformat")
                    else record["date"]
                ),
                "service": str(record["service"]),
                "cost": float(record["cost"]),
                "anomaly_score": float(record["anomaly_score"]),
                "is_anomaly": bool(record["is_anomaly"]),
                "explanation": str(record["explanation"]),
            }
        )
    return serialized


@router.post("/detect")
async def detect_cost_anomalies(
    current_user: dict = Depends(get_current_user),
    aws_service: AwsCostService = Depends(get_aws_service),
    data_processor: CloudCostDataProcessor = Depends(get_anomaly_data_processor),
    anomaly_detector: CloudCostAnomalyDetector = Depends(get_anomaly_detector),
    simulator_service: SimulatorService = Depends(get_simulator_service),
    provider: str = "aws",
) -> dict[str, Any]:
    provider_key = provider.strip().lower()
    simulated_provider = SIMULATED_PROVIDER_MAP.get(provider_key)

    try:
        if simulated_provider:
            raw_costs = simulator_service.generate(providers=[simulated_provider])
        else:
            raw_costs = aws_service.fetch_last_30_days_cost()
        processed_df = data_processor.process(raw_costs)
        anomaly_df = anomaly_detector.detect(processed_df)
    except AwsCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except AwsCostExplorerError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except (DataProcessingError, AnomalyDetectionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while detecting anomalies",
        ) from exc

    anomaly_rows = [
        row for row in anomaly_df.to_dict(orient="records") if bool(row.get("is_anomaly"))
    ]

    if anomaly_rows:
        anomaly_results_collection = get_anomaly_results_collection()
        provider_name = (
            provider_key if provider_key in {"aws", "azure", "gcp"} else (simulated_provider or "aws")
        )
        documents = [
            build_anomaly_result_document(
                user_id=str(current_user["_id"]),
                date=row["date"].to_pydatetime()
                if hasattr(row["date"], "to_pydatetime")
                else row["date"],
                service=str(row["service"]),
                cost=float(row["cost"]),
                anomaly_score=float(row["anomaly_score"]),
                is_anomaly=bool(row["is_anomaly"]),
                explanation=str(row["explanation"]),
                provider=provider_name,
            )
            for row in anomaly_rows
        ]
        await anomaly_results_collection.insert_many(documents)

    anomalies = _serialize_anomalies(anomaly_rows)
    return {
        "message": "Anomaly detection completed successfully",
        "count": len(anomaly_df.index),
        "anomaly_count": len(anomalies),
        "data": anomalies,
    }
