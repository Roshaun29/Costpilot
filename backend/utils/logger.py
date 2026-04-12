import logging
import sys
from datetime import datetime
from typing import Any, Dict, Optional
from models.activity_log import ActivityLog

# Standard Python logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("costpilot")

async def log_activity(
    session,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    meta_data: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None
):
    """Async activity logger that writes to MySQL via SQLAlchemy."""
    try:
        new_log = ActivityLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta_data=meta_data or {},
            ip_address=ip,
            created_at=datetime.utcnow()
        )
        session.add(new_log)
        await session.commit()
        logger.info(f"Activity logged: {action} on {entity_type}:{entity_id} by user {user_id}")
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")
