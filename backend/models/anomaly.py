from pydantic import BaseModel, Field, ConfigDict, GetJsonSchemaHandler
from pydantic_core import core_schema
from typing import Optional, Annotated, Any, Literal
from datetime import datetime
from enum import Enum
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type: Any, _handler: GetJsonSchemaHandler) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(cls.validate),
                ])
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(str),
        )
    @classmethod
    def validate(cls, v: Any) -> ObjectId:
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

class SeverityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class DetectionMethodEnum(str, Enum):
    isolation_forest = "isolation_forest"
    zscore = "zscore"
    combined = "combined"

class AnomalyStatusEnum(str, Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"

class AnomalyBase(BaseModel):
    account_id: PyObjectId
    user_id: PyObjectId
    detected_at: datetime
    service: str
    anomaly_date: datetime
    expected_cost: float
    actual_cost: float
    deviation_percent: float
    severity: SeverityEnum
    detection_method: DetectionMethodEnum
    anomaly_score: float
    status: AnomalyStatusEnum = AnomalyStatusEnum.open
    notes: Optional[str] = None

class AnomalyStatusUpdate(BaseModel):
    status: AnomalyStatusEnum
    notes: Optional[str] = None

class AnomalyResponse(AnomalyBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    created_at: datetime

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

class AnomalyInDB(AnomalyBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )
