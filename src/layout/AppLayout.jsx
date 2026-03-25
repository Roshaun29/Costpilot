import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Anomalies', path: '/anomalies' },
];

export function AppLayout({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} items={navItems} />
      <div className="app-content">
        <Topbar onMenuClick={() => setSidebarOpen(true)} user={user} />
        <main className="page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
