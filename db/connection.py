from __future__ import annotations

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorCollection,
    AsyncIOMotorDatabase,
)

from config import get_settings


settings = get_settings()
_client = AsyncIOMotorClient(settings.mongodb_uri, uuidRepresentation="standard")
_database: AsyncIOMotorDatabase = _client[settings.mongodb_db_name]


def get_database() -> AsyncIOMotorDatabase:
    return _database


def get_users_collection() -> AsyncIOMotorCollection:
    return _database.get_collection("users")


def get_cloud_accounts_collection() -> AsyncIOMotorCollection:
    return _database.get_collection("cloud_accounts")


def get_anomaly_results_collection() -> AsyncIOMotorCollection:
    return _database.get_collection("anomaly_results")


async def ping_database() -> None:
    await _database.command("ping")
