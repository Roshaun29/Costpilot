from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import Settings
from db.connection import (
    get_anomaly_results_collection,
    get_cost_data_collection,
    get_users_collection,
)
from models.anomaly import build_anomaly_result_document
from models.cost_data import build_cost_data_document
from services.anomaly_detector import AnomalyDetectionError, CloudCostAnomalyDetector
from services.aws_service import AwsCostExplorerError, AwsCostService, AwsCredentialsError
from services.data_processor import CloudCostDataProcessor, DataProcessingError
from services.simulator_service import SimulatorService


@dataclass
class SchedulerService:
    settings: Settings
    aws_service: AwsCostService
    data_processor: CloudCostDataProcessor
    anomaly_detector: CloudCostAnomalyDetector
    simulator_service: SimulatorService
    scheduler: AsyncIOScheduler = field(default_factory=AsyncIOScheduler)

    def start(self) -> None:
        if not self.scheduler.running:
            self.scheduler.add_job(
                self.run_cost_anomaly_cycle,
                trigger=IntervalTrigger(minutes=10),
                id="cost-anomaly-detection-job",
                replace_existing=True,
                max_instances=1,
                coalesce=True,
            )
            self.scheduler.start()

    async def shutdown(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    async def run_cost_anomaly_cycle(self) -> None:
        users_collection = get_users_collection()
        active_users = await users_collection.find({"is_active": True}).to_list(length=None)

        for user in active_users:
            try:
                raw_costs = await self._fetch_cost_data()
                if not raw_costs:
                    continue

                await self._store_cost_data(user_id=str(user["_id"]), records=raw_costs)

                processed_df = self.data_processor.process(raw_costs)
                anomaly_df = self.anomaly_detector.detect(processed_df)
                anomaly_records = anomaly_df.to_dict(orient="records")
                anomalies = [record for record in anomaly_records if record["is_anomaly"]]

                if anomalies:
                    await self._store_anomalies(
                        user_id=str(user["_id"]),
                        anomaly_records=anomalies,
                    )
            except (DataProcessingError, AnomalyDetectionError):
                continue
            except Exception:
                continue

    async def _fetch_cost_data(self) -> list[dict[str, Any]]:
        try:
            return self.aws_service.fetch_last_30_days_cost()
        except (AwsCredentialsError, AwsCostExplorerError):
            return self.simulator_service.generate(providers=["aws"])

    async def _store_cost_data(
        self,
        user_id: str,
        records: list[dict[str, Any]],
    ) -> None:
        documents = [
            build_cost_data_document(
                user_id=user_id,
                date_value=record["date"],
                service=str(record["service"]),
                cost=float(record["cost"]),
                provider=str(record["provider"]),
            )
            for record in records
        ]

        if documents:
            cost_data_collection = get_cost_data_collection()
            await cost_data_collection.insert_many(documents)

    async def _store_anomalies(
        self,
        user_id: str,
        anomaly_records: list[dict[str, Any]],
    ) -> None:
        anomaly_documents = [
            build_anomaly_result_document(
                user_id=user_id,
                date=record["date"].to_pydatetime()
                if hasattr(record["date"], "to_pydatetime")
                else record["date"],
                service=str(record["service"]),
                cost=float(record["cost"]),
                anomaly_score=float(record["anomaly_score"]),
                is_anomaly=bool(record["is_anomaly"]),
                explanation=str(record["explanation"]),
                provider="aws",
            )
            for record in anomaly_records
        ]

        if anomaly_documents:
            anomaly_results_collection = get_anomaly_results_collection()
            await anomaly_results_collection.insert_many(anomaly_documents)
