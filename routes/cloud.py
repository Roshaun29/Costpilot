from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from config import Settings, get_settings
from routes.auth import get_current_user
from services.aws_service import (
    AwsCostExplorerError,
    AwsCredentialsError,
    AwsCostService,
    get_aws_cost_service,
)
from services.data_processor import (
    CloudCostDataProcessor,
    DataProcessingError,
    get_cloud_cost_data_processor,
)
from services.simulator_service import SimulatorService


router = APIRouter(prefix="/cloud", tags=["Cloud"])


def get_aws_service(settings: Settings = Depends(get_settings)) -> AwsCostService:
    return get_aws_cost_service(region_name=settings.aws_region)


def get_data_processor() -> CloudCostDataProcessor:
    return get_cloud_cost_data_processor(normalize_cost=True)


def get_simulator_service() -> SimulatorService:
    return SimulatorService()


def _serialize_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
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
            }
        )
    return serialized


@router.get("/sync")
async def sync_cloud_costs(
    _current_user: dict = Depends(get_current_user),
    aws_service: AwsCostService = Depends(get_aws_service),
    data_processor: CloudCostDataProcessor = Depends(get_data_processor),
    simulator_service: SimulatorService = Depends(get_simulator_service),
    provider: str = "aws",
) -> dict[str, Any]:
    try:
        if provider.strip().lower() == "simulated":
            raw_costs = simulator_service.generate(providers=["aws"])
        else:
            raw_costs = aws_service.fetch_last_30_days_cost()
        processed_df = data_processor.process(raw_costs)
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
    except DataProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while syncing cloud cost data",
        ) from exc

    records = _serialize_records(processed_df.to_dict(orient="records"))
    return {
        "message": "Cloud cost data synchronized successfully",
        "count": len(records),
        "data": records,
    }
