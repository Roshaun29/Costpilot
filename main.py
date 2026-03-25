from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db.connection import (
    get_anomaly_results_collection,
    get_cloud_accounts_collection,
    get_cost_data_collection,
    get_users_collection,
    ping_database,
)
from routes.auth import router as auth_router
from routes.cloud import router as cloud_router
from routes.anomaly import router as anomaly_router


settings = get_settings()


def build_scheduler_service():
    from routes.anomaly import get_anomaly_data_processor, get_anomaly_detector
    from routes.cloud import get_aws_service
    from services.scheduler_service import SchedulerService
    from services.simulator_service import SimulatorService

    return SchedulerService(
        settings=settings,
        aws_service=get_aws_service(settings),
        data_processor=get_anomaly_data_processor(),
        anomaly_detector=get_anomaly_detector(settings),
        simulator_service=SimulatorService(),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ping_database()
    users_collection = get_users_collection()
    cloud_accounts_collection = get_cloud_accounts_collection()
    anomaly_results_collection = get_anomaly_results_collection()
    cost_data_collection = get_cost_data_collection()

    await users_collection.create_index("email", unique=True)
    await cloud_accounts_collection.create_index(
        [("user_id", 1), ("provider", 1), ("account_id", 1)],
        unique=True,
    )
    await anomaly_results_collection.create_index([("user_id", 1), ("date", -1)])
    await anomaly_results_collection.create_index([("service", 1), ("is_anomaly", 1)])
    await cost_data_collection.create_index([("user_id", 1), ("date", -1)])
    await cost_data_collection.create_index([("provider", 1), ("service", 1)])

    scheduler_service = build_scheduler_service()
    scheduler_service.start()
    try:
        yield
    finally:
        await scheduler_service.shutdown()


app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(cloud_router)
app.include_router(anomaly_router)


@app.get("/health", tags=["Health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
