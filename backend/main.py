from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from db.mysql import connect_db, close_db
from routes import auth, cloud_accounts, costs, anomalies, alerts
from routes import simulation, insights, activity, settings, websocket, export
from services.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[STARTUP] Connecting to MySQL...")
    await connect_db()
    logger.info("[STARTUP] Starting APScheduler...")
    scheduler = start_scheduler(app)
    app.state.scheduler = scheduler
    logger.info("[STARTUP] CostPilot API ready")
    yield
    logger.info("[SHUTDOWN] Stopping scheduler...")
    if hasattr(app.state, 'scheduler'):
        app.state.scheduler.shutdown()
    logger.info("[SHUTDOWN] Closing MySQL...")
    await close_db()

app = FastAPI(
    title="CostPilot API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:5173",
        "http://frontend:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(cloud_accounts.router, prefix="/api/cloud-accounts", tags=["accounts"])
app.include_router(costs.router, prefix="/api/costs", tags=["costs"])
app.include_router(anomalies.router, prefix="/api/anomalies", tags=["anomalies"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(activity.router, prefix="/api/activity", tags=["activity"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(websocket.router, prefix="/api")
app.include_router(export.router, prefix="/api/export", tags=["export"])

@app.get("/api/health")
async def health():
    return {"status": "ok", "database": "mysql", "version": "2.0.0", "ml_engine": "hybrid_ensemble"}
