from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from math import pi, sin
from random import Random
from typing import Any


SUPPORTED_PROVIDERS = ("aws", "azure", "gcp")


@dataclass(frozen=True)
class ServiceProfile:
    baseline_cost: float
    daily_amplitude: float
    weekly_amplitude: float
    growth_rate: float
    spike_multiplier_range: tuple[float, float]
    anomaly_probability_multiplier: float = 1.0


PROVIDER_SERVICE_PROFILES: dict[str, dict[str, ServiceProfile]] = {
    "aws": {
        "EC2": ServiceProfile(260.0, 0.11, 0.15, 0.0048, (2.1, 3.2), 1.35),
        "S3": ServiceProfile(82.0, 0.03, 0.06, 0.0028, (1.4, 2.0), 0.75),
        "Lambda": ServiceProfile(64.0, 0.18, 0.12, 0.0056, (2.2, 3.8), 1.25),
        "RDS": ServiceProfile(152.0, 0.05, 0.08, 0.0037, (1.5, 2.3), 0.8),
        "CloudFront": ServiceProfile(97.0, 0.12, 0.16, 0.0041, (1.8, 2.9), 1.1),
    },
    "azure": {
        "Virtual Machines": ServiceProfile(205.0, 0.05, 0.07, 0.0036, (1.35, 1.9), 0.65),
        "Blob Storage": ServiceProfile(88.0, 0.02, 0.04, 0.0026, (1.25, 1.7), 0.45),
        "App Services": ServiceProfile(110.0, 0.04, 0.06, 0.0032, (1.3, 1.8), 0.55),
        "Azure SQL": ServiceProfile(148.0, 0.03, 0.05, 0.0031, (1.25, 1.75), 0.5),
        "CDN": ServiceProfile(74.0, 0.06, 0.08, 0.0030, (1.35, 1.95), 0.6),
    },
    "gcp": {
        "Compute Engine": ServiceProfile(225.0, 0.08, 0.11, 0.0044, (1.9, 3.0), 1.15),
        "Cloud Storage": ServiceProfile(72.0, 0.02, 0.05, 0.0027, (1.3, 1.85), 0.55),
        "Cloud Functions": ServiceProfile(52.0, 0.15, 0.11, 0.0052, (1.9, 3.2), 1.0),
        "Cloud SQL": ServiceProfile(138.0, 0.04, 0.06, 0.0033, (1.35, 2.0), 0.7),
        "BigQuery": ServiceProfile(124.0, 0.10, 0.14, 0.0047, (2.3, 4.1), 1.5),
    },
}


PROVIDER_NOISE_MULTIPLIER: dict[str, float] = {
    "aws": 1.15,
    "azure": 0.75,
    "gcp": 1.05,
}


@dataclass
class SimulatorService:
    days: int = 30
    anomaly_probability: float = 0.06
    noise_level: float = 0.08
    seed: int | None = None
    _random: Any = field(init=False)

    def __post_init__(self) -> None:
        if self.days <= 0:
            raise ValueError("days must be greater than 0")
        if not 0 <= self.anomaly_probability <= 1:
            raise ValueError("anomaly_probability must be between 0 and 1")
        if self.noise_level < 0:
            raise ValueError("noise_level must be greater than or equal to 0")

        try:
            self._random = Random(self.seed)
        except Exception:
            self._random = None

    def generate(
        self,
        providers: list[str] | tuple[str, ...] | None = None,
        end_date: datetime | None = None,
    ) -> list[dict[str, Any]]:
        if self._random is None:
            self._random = Random(self.seed)

        selected_providers = self._normalize_providers(providers)
        simulation_end = self._normalize_end_date(end_date)
        simulation_start = simulation_end - timedelta(days=self.days - 1)

        records: list[dict[str, Any]] = []
        for provider in selected_providers:
            for service, profile in PROVIDER_SERVICE_PROFILES[provider].items():
                records.extend(
                    self._generate_service_series(
                        provider=provider,
                        service=service,
                        profile=profile,
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
            return datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

        if end_date.tzinfo is None:
            return end_date.replace(tzinfo=timezone.utc)
        return end_date.astimezone(timezone.utc)

    def _generate_service_series(
        self,
        provider: str,
        service: str,
        profile: ServiceProfile,
        start_date: datetime,
    ) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        random_source = self._random or Random(self.seed)
        daily_offset = random_source.uniform(0, 2 * pi)
        weekly_offset = random_source.uniform(0, 2 * pi)
        provider_noise = self.noise_level * PROVIDER_NOISE_MULTIPLIER[provider]
        anomaly_probability = min(
            self.anomaly_probability * profile.anomaly_probability_multiplier,
            1.0,
        )

        for day_index in range(self.days):
            current_date = start_date + timedelta(days=day_index)
            daily_component = 1 + profile.daily_amplitude * sin((2 * pi * day_index) + daily_offset)
            weekly_component = 1 + profile.weekly_amplitude * sin((2 * pi * day_index / 7) + weekly_offset)
            growth_component = 1 + (profile.growth_rate * day_index)
            noise_component = 1 + random_source.uniform(-provider_noise, provider_noise)

            cost = profile.baseline_cost * daily_component * weekly_component * growth_component
            cost *= max(noise_component, 0.05)

            if random_source.random() < anomaly_probability:
                spike_multiplier = random_source.uniform(*profile.spike_multiplier_range)
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
