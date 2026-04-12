from sqlalchemy import String, Float, Date, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from typing import Optional
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel

class AnomalyResult(Base):
    __tablename__ = "anomaly_results"
    __table_args__ = {"extend_existing": True}
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    account_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    service: Mapped[str] = mapped_column(String(100), nullable=False)
    anomaly_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_cost: Mapped[Optional[float]] = mapped_column(Float)
    actual_cost: Mapped[Optional[float]] = mapped_column(Float)
    deviation_percent: Mapped[Optional[float]] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    detection_method: Mapped[str] = mapped_column(String(30), default="combined")
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="open")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AnomalyResponse(BaseModel):
    id: str
    account_id: str
    user_id: str
    service: str
    anomaly_date: date
    expected_cost: Optional[float]
    actual_cost: Optional[float]
    deviation_percent: Optional[float]
    severity: str
    detection_method: str
    status: str
    notes: Optional[str]
    detected_at: datetime
    model_config = {"from_attributes": True}

class AnomalyStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
