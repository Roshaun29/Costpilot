import logging
import sys
from datetime import datetime
from typing import Any, Dict, Optional
from bson import ObjectId

# Standard Python logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("costpilot")

async def log_activity(
    db,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None
):
    """Async activity logger that writes to MongoDB."""
    log_entry = {
        "user_id": ObjectId(user_id),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata": metadata or {},
        "ip_address": ip,
        "timestamp": datetime.utcnow()
    }
    try:
        await db.activity_logs.insert_one(log_entry)
        logger.info(f"Activity logged: {action} on {entity_type}:{entity_id} by user {user_id}")
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")
