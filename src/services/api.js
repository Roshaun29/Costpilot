import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
    }
    return Promise.reject(error);
  },
);

function persistAuth({ accessToken, refreshToken, user }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY);
  return rawUser ? JSON.parse(rawUser) : null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildChartData(costRows) {
  const totalsByDate = new Map();

  costRows.forEach((row) => {
    const label = new Date(row.date).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    });
    totalsByDate.set(label, (totalsByDate.get(label) || 0) + Number(row.cost));
  });

  const points = Array.from(totalsByDate.entries()).map(([name, cost], index, source) => {
    const priorPoints = source.slice(0, index + 1).map(([, currentCost]) => currentCost);
    const forecast = priorPoints.reduce((sum, current) => sum + current, 0) / priorPoints.length;
    return {
      name,
      cost: Number(cost.toFixed(2)),
      forecast: Number(forecast.toFixed(2)),
    };
  });

  return points;
}

function buildMetrics(costRows, anomalyRows) {
  const totalSpend = costRows.reduce((sum, row) => sum + Number(row.cost), 0);
  const anomalySpend = anomalyRows.reduce((sum, row) => sum + Number(row.cost), 0);
  const providers = new Set(costRows.map((row) => row.provider));

  return [
    {
      label: 'Monthly Spend',
      value: formatCurrency(totalSpend),
      change: `${costRows.length} records`,
      trend: 'up',
    },
    {
      label: 'Potential Savings',
      value: formatCurrency(anomalySpend * 0.18),
      change: `${anomalyRows.length} flagged anomalies`,
      trend: 'up',
    },
    {
      label: 'Active Alerts',
      value: String(anomalyRows.length),
      change: anomalyRows.length ? 'Review recommended' : 'No active alerts',
      trend: anomalyRows.length ? 'down' : 'neutral',
    },
    {
      label: 'Synced Accounts',
      value: String(providers.size).padStart(2, '0'),
      change: `${providers.size} provider${providers.size === 1 ? '' : 's'} connected`,
      trend: 'neutral',
    },
  ];
}

function mapAnomalyRows(rows) {
  return rows.map((row, index) => {
    const score = Number(row.anomaly_score);
    let severity = 'low';
    if (score >= 0.85) severity = 'high';
    else if (score >= 0.6) severity = 'medium';

    return {
      id: `${row.service}-${row.date}-${index}`,
      date: new Date(row.date).toISOString().slice(0, 10),
      service: row.service,
      cost: formatCurrency(Number(row.cost)),
      anomalyScore: score.toFixed(2),
      explanation: row.explanation,
      severity,
    };
  });
}

export async function login(credentials) {
  const loginResponse = await apiClient.post('/auth/login', credentials);
  const accessToken = loginResponse.data.access_token;
  const refreshToken = loginResponse.data.refresh_token;

  persistAuth({ accessToken, refreshToken });

  const meResponse = await apiClient.get('/auth/me');
  const user = {
    ...meResponse.data,
    role: 'FinOps Lead',
  };

  persistAuth({ accessToken, refreshToken, user });

  return {
    token: accessToken,
    refreshToken,
    user,
  };
}

export async function register(payload) {
  await apiClient.post('/auth/register', payload);
  return login({ email: payload.email, password: payload.password });
}

export async function fetchDashboardData(provider = 'aws') {
  const [cloudResponse, anomalyResponse] = await Promise.all([
    apiClient.get('/cloud/sync', { params: { provider } }),
    apiClient.post('/anomaly/detect', null, { params: { provider } }),
  ]);

  const costRows = cloudResponse.data.data ?? [];
  const anomalyRows = anomalyResponse.data.data ?? [];

  return {
    metrics: buildMetrics(costRows, anomalyRows),
    chart: buildChartData(costRows),
    anomalies: mapAnomalyRows(anomalyRows),
  };
}

export async function syncCloudData(provider = 'aws') {
  const response = await apiClient.get('/cloud/sync', { params: { provider } });
  const costRows = response.data.data ?? [];
  const uniqueServices = new Set(costRows.map((row) => row.service));

  return {
    lastSyncedAt: 'Moments ago',
    syncedServices: uniqueServices.size,
  };
}

export async function fetchAnomalies(provider = 'aws') {
  const response = await apiClient.post('/anomaly/detect', null, { params: { provider } });
  return mapAnomalyRows(response.data.data ?? []);
}

export { apiClient };
