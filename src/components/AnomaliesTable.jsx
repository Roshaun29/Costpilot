import { GlassCard } from './GlassCard';

export function AnomaliesTable({ rows, compact = false }) {
  return (
    <GlassCard
      title="Detected anomalies"
      subtitle={compact ? 'Latest signals across services' : 'Recent cost irregularities'}
    >
      <div className="table-shell">
        <table className="anomaly-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Service</th>
              <th>Cost</th>
              <th>Score</th>
              <th>Signal</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td>
                <td>{row.service}</td>
                <td>{row.cost}</td>
                <td>{row.anomalyScore}</td>
                <td>
                  <span className={`severity-pill severity-${row.severity}`}>{row.severity}</span>
                </td>
                <td>{row.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
