import time
import random
import math
import datetime
from .ws_manager import broadcast_live_metrics, broadcast_anomaly
from utils.logger import logger

class LiveSimulator:
    def __init__(self):
        self.account_states = {}
        # Start time for memory leak simulations
        self.start_time = time.time()

    def initialize_account(self, account_id: str, provider: str):
        if account_id not in self.account_states:
            self.account_states[account_id] = {
                "account_id": account_id,
                "provider": provider.lower(),
                "base_metrics": {
                    "EC2": 50.0, "RDS": 30.0, "S3": 10.0, "Lambda": 5.0
                } if provider.lower() == "aws" else {
                    "Virtual Machines": 50.0, "Azure SQL": 30.0, "Blob Storage": 10.0
                },
                "storage_gb": random.uniform(500, 2000),
                "cost_today": 0.0,
                "last_tick": time.time(),
                "network_burst": None,
                "start_time": time.time()
            }

    def get_live_tick(self, account_id: str) -> dict:
        state = self.account_states.get(account_id)
        if not state:
            return {}

        now = datetime.datetime.utcnow()
        t = time.time()
        
        # 1. DIURNAL PATTERN (time-of-day variation)
        hour = now.hour + 5.5  # IST offset
        hour = hour % 24
        if 3.5 <= hour <= 12.5: # 9am-6pm IST
            diurnal_multiplier = 1.0 + (0.4 * math.sin((hour - 3.5) / 9 * math.pi))
        else:
            diurnal_multiplier = 0.6 + random.uniform(0, 0.1)

        # 2. REALISTIC CPU PATTERNS
        minutes = now.minute
        cron_spike = 1.0
        if minutes % 5 == 0:
            cron_spike = random.uniform(1.8, 3.5)
        
        micro_jitter = random.gauss(0, 4.5)
        wave = 15 * math.sin(t / 3)
        noise = random.uniform(-8, 8)
        
        base_cpu = 45.0
        final_cpu = (base_cpu * diurnal_multiplier * cron_spike) + wave + noise + micro_jitter
        final_cpu = max(5, min(95, final_cpu))

        # 3. MEMORY LEAK SIMULATION
        uptime_hours = (t - state["start_time"]) / 3600
        leak_factor = min(1.3, 1.0 + (uptime_hours * 0.02))
        gc_effect = -25 if (t % 30 < 2) else 0 # More frequent GC
        memory = (65 * leak_factor) + gc_effect + random.uniform(-5, 5)
        memory = max(15, min(98, memory))

        # 4. NETWORK BURST
        network_val = random.uniform(10, 50) * diurnal_multiplier
        network_burst_active = False
        if state["network_burst"] and t < state["network_burst"]["ends_at"]:
            network_val *= state["network_burst"]["multiplier"]
            network_burst_active = True
        elif random.random() < 0.002:
            burst_mult = random.uniform(5, 15)
            state["network_burst"] = {
                "multiplier": burst_mult,
                "ends_at": t + random.uniform(10, 30)
            }
            network_val *= burst_mult
            network_burst_active = True

        # 5. STORAGE GROWTH
        if random.random() < 0.0008:
            state["storage_gb"] += random.uniform(0.5, 5.0)
        state["storage_gb"] += random.uniform(0.0003, 0.001)

        # 6. COST ACCUMULATION
        # Enterprise-grade realistic simulation: $50 - $180 per hour base
        base_hourly = 85.0 * diurnal_multiplier * cron_spike
        # Add high frequency volatility to the rate
        cost_per_hour = base_hourly + random.uniform(-10.0, 25.0)
        
        per_second_cost = cost_per_hour / 3600
        state["cost_today"] += per_second_cost

        # 7. EVENTS
        events = []
        if cron_spike > 1.5: events.append({"type": "cron_job", "service": "EC2"})
        if network_burst_active: events.append({"type": "network_burst", "service": "Global", "rate": round(network_val, 1)})
        if gc_effect < 0: events.append({"type": "gc_event", "service": "RDS"})
        
        # Cold start simulation
        if random.random() < 0.01:
            events.append({"type": "cold_start", "service": "Lambda", "duration": random.randint(800, 2500)})

        return {
            "account_id": account_id,
            "provider": state["provider"],
            "timestamp": now.isoformat(),
            "cpu_pct": round(final_cpu, 1),
            "memory_pct": round(memory, 1),
            "storage_gb": round(state["storage_gb"], 3),
            "network_mbps": round(network_val, 1),
            "total_cost_rate_per_hour": round(cost_per_hour, 4),
            "total_cost_today": round(state["cost_today"], 4),
            "events": events
        }

# Global singleton
live_simulator = LiveSimulator()
