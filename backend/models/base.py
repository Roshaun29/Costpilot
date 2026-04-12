import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from db.mysql import Base

def new_uuid() -> str:
    return str(uuid.uuid4())
