from sqlalchemy import String, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel

class Alert(Base):
    __tablename__ = "alerts"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    anomaly_id: Mapped[Optional[str]] = mapped_column(String(36))
    account_id: Mapped[Optional[str]] = mapped_column(String(36))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    error_detail: Mapped[Optional[str]] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AlertResponse(BaseModel):
    id: str
    user_id: str
    anomaly_id: Optional[str]
    channel: str
    status: str
    message: str
    is_read: bool
    sent_at: datetime
    model_config = {"from_attributes": True}
