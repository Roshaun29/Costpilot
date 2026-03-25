import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';

import { AppLayout } from './layout/AppLayout';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function ProtectedApp({ user }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout user={user} />;
}

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onAuth={setUser} />} />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage onAuth={setUser} />}
      />
      <Route element={<ProtectedApp user={user} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/anomalies" element={<AnomaliesPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
