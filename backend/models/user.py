from pydantic import BaseModel, EmailStr, Field, ConfigDict, GetJsonSchemaHandler
from pydantic_core import core_schema
from typing import Optional, Annotated, Any
from datetime import datetime
from bson import ObjectId

# PyObjectId helper for MongoDB _id fields
class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: GetJsonSchemaHandler
    ) -> core_schema.CoreSchema:
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

class NotificationPrefs(BaseModel):
    email: bool = True
    sms: bool = True
    in_app: bool = True

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone_number: Optional[str] = None
    notification_prefs: NotificationPrefs = Field(default_factory=NotificationPrefs)
    alert_threshold_percent: int = 25

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    notification_prefs: Optional[NotificationPrefs] = None
    alert_threshold_percent: Optional[int] = None

class UserResponse(UserBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
        json_encoders={ObjectId: str}
    )

class UserInDB(UserBase):
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True
    )
