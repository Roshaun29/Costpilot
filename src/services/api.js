import { anomalyRows, chartData, metricCards } from './mockData';

const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function login(credentials) {
  await pause(700);
  return {
    token: 'demo-token',
    user: {
      name: credentials.email?.split('@')[0] || 'Analyst',
      email: credentials.email,
      role: 'FinOps Lead',
    },
  };
}

export async function register(payload) {
  await pause(900);
  return {
    token: 'demo-token',
    user: {
      name: payload.name,
      email: payload.email,
      role: 'Workspace Admin',
    },
  };
}

export async function fetchDashboardData() {
  await pause(600);
  return {
    metrics: metricCards,
    chart: chartData,
    anomalies: anomalyRows,
  };
}

export async function syncCloudData() {
  await pause(1200);
  return {
    lastSyncedAt: 'Moments ago',
    syncedServices: 12,
  };
}

export async function fetchAnomalies() {
  await pause(550);
  return anomalyRows;
}
