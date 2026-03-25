from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.user import PyObjectId


class AnomalyResultBase(BaseModel):
    date: datetime
    service: str = Field(min_length=1, max_length=120)
    cost: float
    anomaly_score: float
    is_anomaly: bool
    explanation: str = Field(min_length=1, max_length=255)
    provider: str = Field(default="aws", min_length=2, max_length=30)

    @field_validator("service", "explanation", "provider")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be empty")
        return cleaned


class AnomalyResultCreate(AnomalyResultBase):
    user_id: PyObjectId
    cloud_account_id: PyObjectId | None = None


class AnomalyResultInDB(AnomalyResultBase):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    cloud_account_id: PyObjectId | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class AnomalyResultResponse(AnomalyResultBase):
    id: PyObjectId
    user_id: PyObjectId
    cloud_account_id: PyObjectId | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


def build_anomaly_result_document(
    user_id: str,
    date: datetime,
    service: str,
    cost: float,
    anomaly_score: float,
    is_anomaly: bool,
    explanation: str,
    provider: str = "aws",
    cloud_account_id: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    document: dict[str, Any] = {
        "user_id": ObjectId(user_id),
        "date": date if date.tzinfo else date.replace(tzinfo=timezone.utc),
        "service": service,
        "cost": float(cost),
        "anomaly_score": float(anomaly_score),
        "is_anomaly": bool(is_anomaly),
        "explanation": explanation,
        "provider": provider,
        "created_at": now,
        "updated_at": now,
    }
    if cloud_account_id:
        document["cloud_account_id"] = ObjectId(cloud_account_id)
    return document


def serialize_anomaly_result(document: dict[str, Any]) -> AnomalyResultResponse:
    return AnomalyResultResponse(
        id=str(document["_id"]),
        user_id=str(document["user_id"]),
        cloud_account_id=(
            str(document["cloud_account_id"])
            if document.get("cloud_account_id") is not None
            else None
        ),
        date=document["date"],
        service=document["service"],
        cost=float(document["cost"]),
        anomaly_score=float(document["anomaly_score"]),
        is_anomaly=bool(document["is_anomaly"]),
        explanation=document["explanation"],
        provider=document.get("provider", "aws"),
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )
