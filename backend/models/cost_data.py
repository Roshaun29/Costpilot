from sqlalchemy import String, Boolean, Float, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from typing import Optional
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel

class CostData(Base):
    __tablename__ = "cost_data"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    account_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    cost_date: Mapped[date] = mapped_column(Date, nullable=False)
    service: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[Optional[str]] = mapped_column(String(100))
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    usage_quantity: Mapped[Optional[float]] = mapped_column(Float)
    usage_unit: Mapped[Optional[str]] = mapped_column(String(50))
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=False)
    is_real: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CostDataResponse(BaseModel):
    id: str
    account_id: str
    cost_date: date
    service: str
    cost_usd: float
    is_anomaly: bool
    model_config = {"from_attributes": True}
