import { useEffect, useState, startTransition } from 'react';

import { AnomaliesTable } from '../components/AnomaliesTable';
import { CostChart } from '../components/CostChart';
import { GlassCard } from '../components/GlassCard';
import { StatCard } from '../components/StatCard';
import { SyncButton } from '../components/SyncButton';
import { fetchDashboardData, syncCloudData } from '../services/api';

export function DashboardPage() {
  const [dashboard, setDashboard] = useState({ metrics: [], chart: [], anomalies: [] });
  const [syncing, setSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState('Last sync 14 minutes ago');

  useEffect(() => {
    fetchDashboardData().then((data) => {
      startTransition(() => setDashboard(data));
    });
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const response = await syncCloudData();
    setSyncLabel(`${response.lastSyncedAt} - ${response.syncedServices} services refreshed`);
    setSyncing(false);
  };

  return (
    <div className="page-grid">
      <section className="hero-card glass-card">
        <div>
          <p className="eyebrow">Operating snapshot</p>
          <h1>Control cloud spend with anomaly-aware visibility.</h1>
          <p>
            Watch daily spend move against forecast, trigger syncs on demand, and resolve risk before it compounds.
          </p>
        </div>
        <div className="hero-actions">
          <SyncButton onSync={handleSync} loading={syncing} />
          <span className="sync-label">{syncLabel}</span>
        </div>
      </section>

      <section className="stats-grid">
        {dashboard.metrics.map((metric) => (
          <StatCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="dashboard-main-grid">
        <CostChart data={dashboard.chart} />
        <GlassCard title="FinOps posture" subtitle="This week at a glance">
          <div className="insight-list">
            <div className="insight-row">
              <strong>Forecast confidence</strong>
              <span>94.2%</span>
            </div>
            <div className="insight-row">
              <strong>Highest volatility</strong>
              <span>Amazon EC2</span>
            </div>
            <div className="insight-row">
              <strong>Estimated budget risk</strong>
              <span>Moderate</span>
            </div>
            <div className="insight-highlight">
              Blue-glow risk detection is watching abnormal cost drift across your linked workloads.
            </div>
          </div>
        </GlassCard>
      </section>

      <AnomaliesTable rows={dashboard.anomalies} compact />
    </div>
  );
}
