from sqlalchemy import String, JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional, Any, Dict
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel, ConfigDict

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = {"extend_existing": True}
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=True)
    meta_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Pydantic schemas
class ActivityLogBase(BaseModel):
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    meta_data: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: datetime = datetime.utcnow()

class ActivityLogResponse(ActivityLogBase):
    id: str
    user_id: str
    
    model_config = ConfigDict(from_attributes=True)
