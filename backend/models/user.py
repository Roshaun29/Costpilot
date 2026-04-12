from sqlalchemy import String, Boolean, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel, EmailStr
from typing import Optional

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notif_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notif_sms: Mapped[bool] = mapped_column(Boolean, default=True)
    notif_in_app: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_threshold_percent: Mapped[int] = mapped_column(Integer, default=25)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Pydantic schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone_number: Optional[str]
    notif_email: bool
    notif_sms: bool
    notif_in_app: bool
    alert_threshold_percent: int
    created_at: datetime
    model_config = {"from_attributes": True}

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    notif_email: Optional[bool] = None
    notif_sms: Optional[bool] = None
    notif_in_app: Optional[bool] = None
    alert_threshold_percent: Optional[int] = None
