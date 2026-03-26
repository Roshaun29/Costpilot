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

class ProviderEnum(str, Enum):
    aws = "aws"
    azure = "azure"
    gcp = "gcp"

class SyncStatusEnum(str, Enum):
    idle = "idle"
    syncing = "syncing"
    synced = "synced"
    error = "error"

class CloudAccountBase(BaseModel):
    provider: ProviderEnum
    account_name: str
    account_id_simulated: str = ""
    region: str
    is_active: bool = True
    sync_status: SyncStatusEnum = SyncStatusEnum.idle
    monthly_budget: float = 5000.0

class CloudAccountCreate(CloudAccountBase):
    pass

class CloudAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    is_active: Optional[bool] = None
    monthly_budget: Optional[float] = None
    sync_status: Optional[SyncStatusEnum] = None
    last_synced_at: Optional[datetime] = None

class CloudAccountResponse(CloudAccountBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    user_id: PyObjectId
    last_synced_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )

class CloudAccountInDB(CloudAccountBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    user_id: PyObjectId
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )
