import { useEffect, useState, startTransition } from 'react';

import { AnomaliesTable } from '../components/AnomaliesTable';
import { GlassCard } from '../components/GlassCard';
import { anomalyInsights } from '../services/mockData';
import { fetchAnomalies } from '../services/api';

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
