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

class AlertChannelEnum(str, Enum):
    email = "email"
    sms = "sms"
    in_app = "in_app"

class AlertStatusEnum(str, Enum):
    sent = "sent"
    failed = "failed"
    pending = "pending"

class AlertBase(BaseModel):
    user_id: PyObjectId
    anomaly_id: PyObjectId
    account_id: PyObjectId
    channel: AlertChannelEnum
    status: AlertStatusEnum
    message: str
    sent_at: datetime
    read: bool = False

class AlertResponse(AlertBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

class AlertInDB(AlertBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )
