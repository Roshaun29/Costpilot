from sqlalchemy import String, Boolean, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from db.mysql import Base
from .base import new_uuid
from pydantic import BaseModel

class SimulationState(Base):
    __tablename__ = "simulation_state"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    is_running: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_tick_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tick_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SimulationStatusResponse(BaseModel):
    is_running: bool
    last_tick_at: Optional[datetime]
    tick_count: int
    accounts_monitored: int
    started_at: Optional[datetime]
