import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ErrorBoundary from '../ui/ErrorBoundary';
import { useThemeStore } from '../../store/themeStore';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-bg-primary text-text-primary flex overflow-hidden lg:overflow-visible relative transition-colors duration-300">
        
        {/* Modern Background Effects */}
        <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/5 blur-[120px] rounded-full opacity-50" />
            <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-accent-cyan/5 blur-[120px] rounded-full opacity-40" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay" />
        </div>

        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        
        <div className="flex-1 lg:ml-[240px] flex flex-col min-h-screen relative w-full max-w-[100vw]">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 mt-16 p-6 md:p-10 relative z-10 w-full max-w-[1440px] mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
