from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type: Any, _handler: Any) -> Any:
        from pydantic_core import core_schema

        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.str_schema(),
        )

    @classmethod
    def validate(cls, value: Any) -> str:
        if isinstance(value, ObjectId):
            return str(value)
        if not ObjectId.is_valid(value):
            raise ValueError("Invalid ObjectId")
        return str(value)


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = " ".join(value.split()).strip()
        if not cleaned:
            raise ValueError("Name cannot be empty")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserInDB(UserBase):
    id: PyObjectId = Field(alias="_id")
    hashed_password: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class UserResponse(UserBase):
    id: PyObjectId
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CloudAccountBase(BaseModel):
    provider: str = Field(default="aws", min_length=2, max_length=30)
    account_id: str = Field(min_length=3, max_length=64)
    account_name: str = Field(min_length=2, max_length=100)

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("account_id", "account_name")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be empty")
        return cleaned


class CloudAccountCreate(CloudAccountBase):
    user_id: PyObjectId


class CloudAccountInDB(CloudAccountBase):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class CloudAccountResponse(CloudAccountBase):
    id: PyObjectId
    user_id: PyObjectId
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def build_user_document(name: str, email: str, hashed_password: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "name": name,
        "email": email,
        "hashed_password": hashed_password,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def build_cloud_account_document(
    user_id: str,
    provider: str,
    account_id: str,
    account_name: str,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "user_id": ObjectId(user_id),
        "provider": provider,
        "account_id": account_id,
        "account_name": account_name,
        "created_at": now,
        "updated_at": now,
    }


def serialize_user(document: dict[str, Any]) -> UserResponse:
    return UserResponse(
        id=str(document["_id"]),
        name=document["name"],
        email=document["email"],
        is_active=document["is_active"],
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )


def serialize_cloud_account(document: dict[str, Any]) -> CloudAccountResponse:
    return CloudAccountResponse(
        id=str(document["_id"]),
        user_id=str(document["user_id"]),
        provider=document["provider"],
        account_id=document["account_id"],
        account_name=document["account_name"],
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )
