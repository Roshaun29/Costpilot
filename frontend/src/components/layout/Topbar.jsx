import { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Menu, Settings, LogOut, User, Sun, Moon, Clock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SimulationToggle from '../ui/SimulationToggle';
import AlertBell from '../alerts/AlertBell';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useLiveData } from '../../hooks/useLiveData';
import { formatINR } from '../../utils/currency';

const routeNames = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Cloud Accounts',
  '/costs': 'Cost Explorer',
  '/anomalies': 'Anomalies',
  '/alerts': 'Alerts',
  '/insights': 'Insights',
  '/activity': 'Activity Log',
  '/settings': 'Settings',
};

const ISTClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const i = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(i);
    }, []);
    // IST is UTC + 5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(time.getTime() + (time.getTimezoneOffset() * 60000) + istOffset);
    
    return (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-raised border border-border-subtle group transition-all hover:border-brand/40">
            <Clock size={12} className="text-text-muted group-hover:text-brand" />
            <span className="text-[10px] font-mono font-bold text-text-secondary group-hover:text-text-primary">
                {istTime.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
            </span>
        </div>
    );
};

const LiveMetricTicker = () => {
    const { liveMetrics } = useLiveData();
    const totalRate = Object.values(liveMetrics).reduce((sum, m) => sum + (m.total_cost_rate_per_hour || 0), 0);
    
    if (totalRate === 0) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full bg-brand/5 border border-brand/20"
        >
            <div className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand"></span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-brand">
                Pulse: {formatINR(totalRate)}/hr
            </span>
        </motion.div>
    );
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = routeNames[location.pathname] || 'CostPilot';
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="h-16 fixed top-0 right-0 left-0 lg:left-[240px] z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-border-subtle px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <button className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <h1 className="text-xl font-display font-medium text-text-primary hidden sm:block">{title}</h1>
        <LiveMetricTicker />
      </div>
      
      <div className="flex items-center gap-4 sm:gap-6">
        <ISTClock />

        <button 
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-bg-raised border border-border-subtle text-text-secondary hover:text-brand hover:border-brand/40 transition-all"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <SimulationToggle />
        <div className="w-[1px] h-6 bg-border-subtle hidden sm:block"></div>
        <AlertBell />

        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-full bg-bg-raised flex items-center justify-center font-black text-[11px] text-text-primary border border-border-subtle hover:border-brand transition-all ring-1 ring-white/5"
          >
            {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'CP'}
          </button>
          
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-3 w-56 bg-bg-surface border border-border-strong rounded-2xl shadow-xl overflow-hidden z-50 py-1"
              >
                <div className="px-5 py-4 border-b border-border-subtle mb-1">
                  <p className="text-sm font-bold text-text-primary truncate">{user?.full_name}</p>
                  <p className="text-[11px] text-text-muted font-medium truncate mt-0.5">{user?.email}</p>
                </div>
                
                <Link to="/settings" onClick={() => setMenuOpen(false)} className="mx-1 mt-1 flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-xl transition-all">
                  <Settings size={16} /> <span className="font-medium">Settings</span>
                </Link>
                
                <button onClick={handleLogout} className="w-[calc(100%-8px)] mx-1 flex items-center gap-3 px-4 py-2.5 text-sm text-accent-red hover:bg-accent-red/10 rounded-xl transition-all mt-1 border-t border-border-subtle pt-3">
                  <LogOut size={16} /> <span className="font-bold">Logout</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
