from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import get_settings
from db.connection import (
    get_anomaly_results_collection,
    get_cloud_accounts_collection,
    get_users_collection,
    ping_database,
)
from routes.anomaly import router as anomaly_router
from routes.auth import router as auth_router
from routes.cloud import router as cloud_router


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ping_database()
    users_collection = get_users_collection()
    cloud_accounts_collection = get_cloud_accounts_collection()
    anomaly_results_collection = get_anomaly_results_collection()

    await users_collection.create_index("email", unique=True)
    await cloud_accounts_collection.create_index(
        [("user_id", 1), ("provider", 1), ("account_id", 1)],
        unique=True,
    )
    await anomaly_results_collection.create_index([("user_id", 1), ("date", -1)])
    await anomaly_results_collection.create_index([("service", 1), ("is_anomaly", 1)])
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    lifespan=lifespan,
)
app.include_router(auth_router)
app.include_router(cloud_router)
app.include_router(anomaly_router)


@app.get("/health", tags=["Health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
