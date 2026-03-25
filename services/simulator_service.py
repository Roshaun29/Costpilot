from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import pi, sin
from random import Random
from typing import Any


SUPPORTED_PROVIDERS = ("aws", "azure", "gcp")
SUPPORTED_SERVICES = ("EC2", "S3", "Lambda", "RDS", "CloudFront")


@dataclass(frozen=True, slots=True)
class ServiceProfile:
    baseline_cost: float
    daily_amplitude: float
    weekly_amplitude: float
    growth_rate: float
    spike_multiplier_range: tuple[float, float]


BASE_SERVICE_PROFILES: dict[str, ServiceProfile] = {
    "EC2": ServiceProfile(
        baseline_cost=240.0,
        daily_amplitude=0.08,
        weekly_amplitude=0.12,
        growth_rate=0.0045,
        spike_multiplier_range=(1.8, 2.9),
    ),
    "S3": ServiceProfile(
        baseline_cost=75.0,
        daily_amplitude=0.03,
        weekly_amplitude=0.06,
        growth_rate=0.0030,
        spike_multiplier_range=(1.5, 2.2),
    ),
    "Lambda": ServiceProfile(
        baseline_cost=58.0,
        daily_amplitude=0.15,
        weekly_amplitude=0.10,
        growth_rate=0.0055,
        spike_multiplier_range=(2.0, 3.4),
    ),
    "RDS": ServiceProfile(
        baseline_cost=145.0,
        daily_amplitude=0.05,
        weekly_amplitude=0.08,
        growth_rate=0.0038,
        spike_multiplier_range=(1.6, 2.4),
    ),
    "CloudFront": ServiceProfile(
        baseline_cost=92.0,
        daily_amplitude=0.10,
        weekly_amplitude=0.14,
        growth_rate=0.0042,
        spike_multiplier_range=(1.7, 2.8),
    ),
}


PROVIDER_BASELINE_MULTIPLIER: dict[str, float] = {
    "aws": 1.0,
    "azure": 0.93,
    "gcp": 0.89,
}


@dataclass(slots=True)
class SimulatorService:
    days: int = 30
    anomaly_probability: float = 0.06
    noise_level: float = 0.08
    seed: int | None = None

    def __post_init__(self) -> None:
        if self.days <= 0:
            raise ValueError("days must be greater than 0")
        if not 0 <= self.anomaly_probability <= 1:
            raise ValueError("anomaly_probability must be between 0 and 1")
        if self.noise_level < 0:
            raise ValueError("noise_level must be greater than or equal to 0")

        self._random = Random(self.seed)

    def generate(
        self,
        providers: list[str] | tuple[str, ...] | None = None,
        end_date: datetime | None = None,
    ) -> list[dict[str, Any]]:
        selected_providers = self._normalize_providers(providers)
        simulation_end = self._normalize_end_date(end_date)
        simulation_start = simulation_end - timedelta(days=self.days - 1)

        records: list[dict[str, Any]] = []
        for provider in selected_providers:
            provider_multiplier = PROVIDER_BASELINE_MULTIPLIER[provider]
            for service in SUPPORTED_SERVICES:
                records.extend(
                    self._generate_service_series(
                        provider=provider,
                        service=service,
                        provider_multiplier=provider_multiplier,
                        start_date=simulation_start,
                    )
                )

        records.sort(key=lambda record: (record["date"], record["provider"], record["service"]))
        return records

    def _normalize_providers(
        self,
        providers: list[str] | tuple[str, ...] | None,
    ) -> tuple[str, ...]:
        if providers is None:
            return SUPPORTED_PROVIDERS

        normalized: list[str] = []
        for provider in providers:
            provider_name = provider.strip().lower()
            if provider_name not in SUPPORTED_PROVIDERS:
                raise ValueError(f"Unsupported provider: {provider}")
            normalized.append(provider_name)
        return tuple(normalized)

    def _normalize_end_date(self, end_date: datetime | None) -> datetime:
        if end_date is None:
            today = datetime.now(timezone.utc)
            return datetime(
                year=today.year,
                month=today.month,
                day=today.day,
                tzinfo=timezone.utc,
            )

        if end_date.tzinfo is None:
            return end_date.replace(tzinfo=timezone.utc)
        return end_date.astimezone(timezone.utc)

    def _generate_service_series(
        self,
        provider: str,
        service: str,
        provider_multiplier: float,
        start_date: datetime,
    ) -> list[dict[str, Any]]:
        profile = BASE_SERVICE_PROFILES[service]
        records: list[dict[str, Any]] = []

        service_baseline = profile.baseline_cost * provider_multiplier
        daily_offset = self._random.uniform(0, 2 * pi)
        weekly_offset = self._random.uniform(0, 2 * pi)

        for day_index in range(self.days):
            current_date = start_date + timedelta(days=day_index)
            daily_component = 1 + profile.daily_amplitude * sin(
                (2 * pi * day_index) + daily_offset
            )
            weekly_component = 1 + profile.weekly_amplitude * sin(
                (2 * pi * day_index / 7) + weekly_offset
            )
            growth_component = 1 + (profile.growth_rate * day_index)
            noise_component = 1 + self._random.uniform(-self.noise_level, self.noise_level)

            cost = service_baseline * daily_component * weekly_component * growth_component
            cost *= max(noise_component, 0.05)

            if self._random.random() < self.anomaly_probability:
                spike_multiplier = self._random.uniform(*profile.spike_multiplier_range)
                cost *= spike_multiplier

            records.append(
                {
                    "date": current_date,
                    "service": service,
                    "cost": round(max(cost, 0.0), 2),
                    "provider": provider,
                }
            )

        return records
