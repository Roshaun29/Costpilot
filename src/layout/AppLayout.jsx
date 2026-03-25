import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { navItems } from '../services/mockData';

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
