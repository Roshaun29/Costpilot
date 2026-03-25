from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import get_settings


settings = get_settings()
client = AsyncIOMotorClient(settings.mongodb_uri, uuidRepresentation="standard")
database: AsyncIOMotorDatabase = client[settings.mongodb_db_name]


async def ping_database() -> None:
    await database.command("ping")


def get_database() -> AsyncIOMotorDatabase:
    return database
