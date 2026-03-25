export function SyncButton({ onSync, loading }) {
  return (
    <button className="primary-button sync-button" onClick={onSync} type="button" disabled={loading}>
      <span className={`sync-dot ${loading ? 'is-loading' : ''}`} />
      {loading ? 'Syncing cloud data...' : 'Sync Data'}
    </button>
  );
}
