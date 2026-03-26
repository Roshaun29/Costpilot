import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ErrorBoundary from '../ui/ErrorBoundary';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex overflow-hidden lg:overflow-visible">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        
        <div className="flex-1 lg:ml-[240px] flex flex-col min-h-screen relative w-full max-w-[100vw]">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 mt-16 p-4 md:p-8 relative z-10 w-full max-w-7xl mx-auto overflow-x-hidden">
            <div className="absolute inset-0 bg-grid opacity-[0.02] pointer-events-none"></div>
            <Outlet />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
