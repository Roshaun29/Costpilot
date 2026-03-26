from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from backend.db.mongodb import connect_to_mongo, close_mongo_connection, init_indexes
from backend.services.scheduler import start_scheduler

from backend.routes import auth, cloud_accounts, costs, anomalies, alerts, simulation, insights, activity, settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Events
    logger.info("CostPilot API starting...")
    await connect_to_mongo()
    await init_indexes()
    global scheduler_inst
    scheduler_inst = start_scheduler(app)
    logger.info("CostPilot API running on port 8000")
    yield
    # Shutdown Events
    logger.info("CostPilot API shutting down...")
    if scheduler_inst:
        scheduler_inst.shutdown()
    await close_mongo_connection()

app = FastAPI(title="CostPilot API", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled system exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error", "detail": str(exc)},
    )

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(cloud_accounts.router, prefix="/api/cloud-accounts", tags=["Cloud Accounts"])
app.include_router(costs.router, prefix="/api/costs", tags=["Costs"])
app.include_router(anomalies.router, prefix="/api/anomalies", tags=["Anomalies"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(insights.router, prefix="/api/insights", tags=["Insights"])
app.include_router(activity.router, prefix="/api/activity", tags=["Activity"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
