import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSimulationStore } from './store/simulationStore';
import { useNotificationStore } from './store/notificationStore';

import Layout from './components/layout/Layout';
import PageLoader from './components/ui/PageLoader';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CloudAccounts from './pages/CloudAccounts';
import CostExplorer from './pages/CostExplorer';
import Anomalies from './pages/Anomalies';
import Alerts from './pages/Alerts';
import Insights from './pages/Insights';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

function PrivateRoute({ children }) {
  const { isAuthenticated, token } = useAuthStore();
  if (!isAuthenticated && !token && !localStorage.getItem('costpilot_token')) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [initing, setIniting] = useState(true);
  const { initialize, isAuthenticated } = useAuthStore();
  const { startPolling: startSim, stopPolling: stopSim } = useSimulationStore();
  const { startPolling: startNotif, stopPolling: stopNotif } = useNotificationStore();

  useEffect(() => {
    initialize().finally(() => setIniting(false));
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated) {
      startSim();
      startNotif();
    } else {
      stopSim();
      stopNotif();
    }
    return () => {
      stopSim();
      stopNotif();
    };
  }, [isAuthenticated, startSim, stopSim, startNotif, stopNotif]);

  if (initing) return <PageLoader />;

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<CloudAccounts />} />
        <Route path="costs" element={<CostExplorer />} />
        <Route path="anomalies" element={<Anomalies />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="insights" element={<Insights />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
