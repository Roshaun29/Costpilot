from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel

class Insight(Base):
    __tablename__ = "insights"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    insight_type: Mapped[str] = mapped_column(String(50), nullable=False)
    headline: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    account_id: Mapped[Optional[str]] = mapped_column(String(36))
    related_anomaly_id: Mapped[Optional[str]] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class InsightResponse(BaseModel):
    id: str
    insight_type: str
    headline: str
    body: str
    created_at: datetime
    model_config = {"from_attributes": True}
