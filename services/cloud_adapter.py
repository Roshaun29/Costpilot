from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from config import Settings, get_settings
from services.aws_service import AwsCostService


NormalizedCostRecord = dict[str, Any]
ProviderFetcher = Callable[[], list[dict[str, Any]]]


class CloudAdapterError(Exception):
    """Base exception for cloud adapter failures."""


class ProviderNotSupportedError(CloudAdapterError):
    """Raised when a requested provider is not registered."""


class ProviderNotConfiguredError(CloudAdapterError):
    """Raised when a provider adapter is present but lacks credentials or a fetcher."""


class CloudProviderAdapter(Protocol):
    provider_name: str

    def fetch_last_30_days_cost(self) -> list[NormalizedCostRecord]:
        """Fetch and normalize provider cost data."""


@dataclass
class AwsCloudAdapter:
    aws_service: AwsCostService
    provider_name: str = "aws"

    def fetch_last_30_days_cost(self) -> list[NormalizedCostRecord]:
        records = self.aws_service.fetch_last_30_days_cost()
        return [self._normalize_record(record) for record in records]

    def _normalize_record(self, record: dict[str, Any]) -> NormalizedCostRecord:
        return {
            "date": record["date"],
            "service": str(record["service"]).strip(),
            "cost": float(record["cost"]),
            "provider": self.provider_name,
        }


@dataclass
class AzureCloudAdapter:
    fetcher: ProviderFetcher | None = None
    provider_name: str = "azure"

    def fetch_last_30_days_cost(self) -> list[NormalizedCostRecord]:
        if self.fetcher is None:
            raise ProviderNotConfiguredError(
                "Azure provider is registered but no fetcher/client is configured."
            )

        return [self._normalize_record(record) for record in self.fetcher()]

    def _normalize_record(self, record: dict[str, Any]) -> NormalizedCostRecord:
        return {
            "date": record.get("date") or record.get("usage_date"),
            "service": str(
                record.get("service")
                or record.get("meterCategory")
                or record.get("resource_type", "")
            ).strip(),
            "cost": float(
                record.get("cost")
                or record.get("amount")
                or record.get("pretaxCost")
                or 0
            ),
            "provider": self.provider_name,
        }


@dataclass
class GcpCloudAdapter:
    fetcher: ProviderFetcher | None = None
    provider_name: str = "gcp"

    def fetch_last_30_days_cost(self) -> list[NormalizedCostRecord]:
        if self.fetcher is None:
            raise ProviderNotConfiguredError(
                "GCP provider is registered but no fetcher/client is configured."
            )

        return [self._normalize_record(record) for record in self.fetcher()]

    def _normalize_record(self, record: dict[str, Any]) -> NormalizedCostRecord:
        return {
            "date": record.get("date") or record.get("usage_date") or record.get("invoice_date"),
            "service": str(
                record.get("service")
                or record.get("service_description")
                or record.get("sku_description", "")
            ).strip(),
            "cost": float(
                record.get("cost")
                or record.get("amount")
                or record.get("cost_amount")
                or 0
            ),
            "provider": self.provider_name,
        }


@dataclass
class CloudAdapterService:
    adapters: dict[str, CloudProviderAdapter] = field(default_factory=dict)

    def register_provider(self, adapter: CloudProviderAdapter) -> None:
        self.adapters[adapter.provider_name.lower()] = adapter

    def get_provider(self, provider: str) -> CloudProviderAdapter:
        adapter = self.adapters.get(provider.lower())
        if adapter is None:
            raise ProviderNotSupportedError(f"Unsupported cloud provider: {provider}")
        return adapter

    def fetch_provider_costs(self, provider: str) -> list[NormalizedCostRecord]:
        adapter = self.get_provider(provider)
        return adapter.fetch_last_30_days_cost()

    def fetch_all_costs(self) -> list[NormalizedCostRecord]:
        records: list[NormalizedCostRecord] = []
        for adapter in self.adapters.values():
            try:
                records.extend(adapter.fetch_last_30_days_cost())
            except ProviderNotConfiguredError:
                continue
        return records


def build_default_cloud_adapter_service(
    settings: Settings,
    azure_fetcher: ProviderFetcher | None = None,
    gcp_fetcher: ProviderFetcher | None = None,
) -> CloudAdapterService:
    from services.aws_service import get_aws_cost_service

    service = CloudAdapterService()
    service.register_provider(
        AwsCloudAdapter(aws_service=get_aws_cost_service(region_name=settings.aws_region))
    )
    service.register_provider(AzureCloudAdapter(fetcher=azure_fetcher))
    service.register_provider(GcpCloudAdapter(fetcher=gcp_fetcher))
    return service


def get_cloud_adapter_service() -> CloudAdapterService:
    return build_default_cloud_adapter_service(get_settings())
