import os
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import certifi

logger = logging.getLogger(__name__)

db_client: AsyncIOMotorClient = None
db = None

async def connect_to_mongo():
    global db_client, db
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    try:
        # Avoid SSL cert failures for Atlas
        kwargs = {}
        if "mongodb+srv" in mongo_url:
            kwargs["tlsCAFile"] = certifi.where()
            
        db_client = AsyncIOMotorClient(mongo_url, **kwargs)
        db = db_client["costpilot"]
        # Fast test connection
        await db.command("ping")
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

async def close_mongo_connection():
    global db_client
    if db_client:
        db_client.close()
        logger.info("Closed MongoDB connection")

async def init_indexes():
    global db
    if db is None:
        return
    try:
        await db.users.create_index("email", unique=True)
        await db.cloud_accounts.create_index("user_id")
        await db.cost_data.create_index([("account_id", 1), ("date", 1), ("service", 1)])
        await db.cost_data.create_index("user_id")
        await db.anomaly_results.create_index([("account_id", 1), ("status", 1)])
        await db.anomaly_results.create_index("user_id")
        await db.alerts.create_index([("user_id", 1), ("read", 1)])
        await db.alerts.create_index([("sent_at", -1)])
        await db.activity_logs.create_index([("user_id", 1), ("timestamp", -1)])
        await db.simulation_state.create_index("user_id", unique=True)
        logger.info("MongoDB indexes successfully mapped")
    except Exception as e:
        logger.error(f"Failed to init indexes: {e}")

def get_db():
    return db
