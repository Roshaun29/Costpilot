import { useEffect, useState, startTransition } from 'react';

import { AnomaliesTable } from '../components/AnomaliesTable';
import { CostChart } from '../components/CostChart';
import { GlassCard } from '../components/GlassCard';
import { InputField } from '../components/InputField';
import { StatCard } from '../components/StatCard';
import { SyncButton } from '../components/SyncButton';
import { addCloudAccount, fetchDashboardData, syncCloudData } from '../services/api';

const CONNECTION_STEPS = [
  'Validating credentials...',
  'Connecting...',
  'Fetching billing data...',
];

const wait = (duration) => new Promise((resolve) => {
  window.setTimeout(resolve, duration);
});

export function DashboardPage() {
  const [dashboard, setDashboard] = useState({ metrics: [], chart: [], anomalies: [] });
  const [syncing, setSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState('Ready to sync live backend data');
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ provider: 'aws', account_name: '' });
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [connectionStep, setConnectionStep] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  useEffect(() => {
    fetchDashboardData()
      .then((data) => {
        startTransition(() => setDashboard(data));
      })
      .catch(() => {
        setSyncLabel('Unable to load dashboard data');
      });
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await syncCloudData();
      setSyncLabel(`${response.lastSyncedAt} - ${response.syncedServices} services refreshed`);
    } catch {
      setSyncLabel('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddAccount = async (event) => {
    event.preventDefault();
    setIsSavingAccount(true);
    setAccountMessage('');

    try {
      for (const step of CONNECTION_STEPS) {
        setConnectionStep(step);
        await wait(800);
      }

      const account = await addCloudAccount(accountForm);
      setConnectedAccounts((current) => [account, ...current]);
      setAccountMessage(`${account.account_name} connected to ${account.provider.toUpperCase()}`);
      setAccountForm({ provider: 'aws', account_name: '' });
      setIsAddAccountOpen(false);
      setConnectionStep('');
    } catch {
      setAccountMessage('Unable to add cloud account');
      setConnectionStep('');
    } finally {
      setIsSavingAccount(false);
    }
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
          <div className="hero-action-row">
            <button className="primary-button secondary-button" type="button" onClick={() => setIsAddAccountOpen(true)}>
              + Add Account
            </button>
            <SyncButton onSync={handleSync} loading={syncing} />
          </div>
          <span className="sync-label">{syncLabel}</span>
          {accountMessage ? <span className="sync-label">{accountMessage}</span> : null}
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

      <GlassCard title="Connected accounts" subtitle="Cloud connection status">
        {connectedAccounts.length ? (
          <div className="connected-accounts-list">
            {connectedAccounts.map((account) => (
              <div className="connected-account-row" key={account.id}>
                <div>
                  <strong>{account.account_name}</strong>
                  <span>{account.provider.toUpperCase()}</span>
                </div>
                <span className="severity-pill severity-connected">{account.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state-copy">No cloud accounts connected yet.</p>
        )}
      </GlassCard>

      <AnomaliesTable rows={dashboard.anomalies} compact />

      {isAddAccountOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => (!isSavingAccount ? setIsAddAccountOpen(false) : null)}>
          <div className="modal-card glass-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <div>
                <p className="eyebrow">Connect cloud account</p>
                <h3>Add a provider workspace</h3>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleAddAccount}>
              <label className="input-group">
                <span>Provider</span>
                <select
                  value={accountForm.provider}
                  onChange={(event) => setAccountForm((current) => ({ ...current, provider: event.target.value }))}
                  disabled={isSavingAccount}
                >
                  <option value="aws">AWS</option>
                  <option value="azure">Azure</option>
                  <option value="gcp">GCP</option>
                </select>
              </label>
              <InputField
                label="Account name"
                placeholder="Production billing account"
                value={accountForm.account_name}
                onChange={(event) => setAccountForm((current) => ({ ...current, account_name: event.target.value }))}
              />
              {connectionStep ? <div className="connection-status">{connectionStep}</div> : null}
              <div className="modal-actions">
                <button className="icon-button modal-button" type="button" onClick={() => setIsAddAccountOpen(false)} disabled={isSavingAccount}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={isSavingAccount}>
                  {isSavingAccount ? connectionStep || 'Connecting...' : 'Connect Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
