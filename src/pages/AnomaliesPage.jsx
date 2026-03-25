import { useEffect, useState, startTransition } from 'react';

import { AnomaliesTable } from '../components/AnomaliesTable';
import { GlassCard } from '../components/GlassCard';
import { fetchAnomalies } from '../services/api';

const anomalyInsights = [
  {
    title: 'Compute drift detected',
    body: 'EC2 workloads in production-east are sustaining an abnormal usage envelope.',
  },
  {
    title: 'Database cost baseline shifted',
    body: 'RDS storage and I/O climbed faster than the weekly forecast window.',
  },
  {
    title: 'Storage expansion under watch',
    body: 'S3 growth is still moderate, but it crossed the normal variance threshold.',
  },
];

export function AnomaliesPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchAnomalies().then((data) => {
      startTransition(() => setRows(data));
    });
  }, []);

  return (
    <div className="page-grid">
      <section className="hero-card glass-card slim-hero">
        <div>
          <p className="eyebrow">Anomaly intelligence</p>
          <h1>Investigate spend spikes with context-rich signals.</h1>
          <p>
            Isolation Forest and z-score alerts are surfaced in a clean workflow designed for fast triage.
          </p>
        </div>
      </section>

      <section className="insight-grid">
        {anomalyInsights.map((insight) => (
          <GlassCard key={insight.title} title={insight.title} className="insight-card">
            <p>{insight.body}</p>
          </GlassCard>
        ))}
      </section>

      <AnomaliesTable rows={rows} />
    </div>
  );
}
