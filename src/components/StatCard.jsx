export function StatCard({ label, value, change, trend }) {
  return (
    <div className="glass-card stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span className={`trend-pill trend-${trend}`}>{change}</span>
    </div>
  );
}
