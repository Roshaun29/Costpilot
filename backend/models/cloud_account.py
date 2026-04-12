from sqlalchemy import String, Boolean, Float, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel
import enum

class Provider(str, enum.Enum):
    aws = "aws"
    azure = "azure"
    gcp = "gcp"

class SyncStatus(str, enum.Enum):
    idle = "idle"
    syncing = "syncing"
    synced = "synced"
    error = "error"

class CloudAccount(Base):
    __tablename__ = "cloud_accounts"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    provider: Mapped[str] = mapped_column(String(10), nullable=False)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id_simulated: Mapped[Optional[str]] = mapped_column(String(100))
    region: Mapped[str] = mapped_column(String(100), default="us-east-1")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_real: Mapped[bool] = mapped_column(Boolean, default=False)
    data_source: Mapped[str] = mapped_column(String(20), default="simulation")
    sync_status: Mapped[str] = mapped_column(String(20), default="idle")
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    monthly_budget: Mapped[float] = mapped_column(Float, default=5000.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CloudAccountCreate(BaseModel):
    provider: Provider
    account_name: str
    region: str = "us-east-1"
    monthly_budget: float = 5000.0

class CloudAccountResponse(BaseModel):
    id: str
    user_id: str
    provider: str
    account_name: str
    account_id_simulated: Optional[str]
    region: str
    is_active: bool
    is_real: bool
    data_source: str
    sync_status: str
    last_synced_at: Optional[datetime]
    monthly_budget: float
    created_at: datetime
    model_config = {"from_attributes": True}
