from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field

from models.user import PyObjectId


class CostDataBase(BaseModel):
    date: datetime
    service: str = Field(min_length=1, max_length=120)
    cost: float
    provider: str = Field(min_length=2, max_length=30)


class CostDataCreate(CostDataBase):
    user_id: PyObjectId


class CostDataInDB(CostDataBase):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class CostDataResponse(CostDataBase):
    id: PyObjectId
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


def _normalize_date(value: datetime | date | str) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def build_cost_data_document(
    user_id: str,
    date_value: datetime | date | str,
    service: str,
    cost: float,
    provider: str,
) -> dict[str, Any]:
    return {
        "user_id": ObjectId(user_id),
        "date": _normalize_date(date_value),
        "service": service,
        "cost": float(cost),
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
    }


def serialize_cost_data(document: dict[str, Any]) -> CostDataResponse:
    return CostDataResponse(
        id=str(document["_id"]),
        date=document["date"],
        service=document["service"],
        cost=float(document["cost"]),
        provider=document["provider"],
        created_at=document["created_at"],
    )
