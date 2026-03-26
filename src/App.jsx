import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { AppLayout } from './layout/AppLayout';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { getStoredUser, hasStoredAuth, subscribeToAuthChanges } from './services/api';

function ProtectedApp({ user }) {
  if (!user || !hasStoredAuth()) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout user={user} />;
}

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const syncAuthState = () => {
      setUser(getStoredUser());
    };

    const unsubscribe = subscribeToAuthChanges(syncAuthState);
    window.addEventListener('storage', syncAuthState);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={user && hasStoredAuth() ? <Navigate to="/dashboard" replace /> : <LoginPage onAuth={setUser} />} />
      <Route
        path="/register"
        element={user && hasStoredAuth() ? <Navigate to="/dashboard" replace /> : <RegisterPage onAuth={setUser} />}
      />
      <Route element={<ProtectedApp user={user} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/anomalies" element={<AnomaliesPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user && hasStoredAuth() ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
