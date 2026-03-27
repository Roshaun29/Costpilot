import { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Menu, Settings, LogOut, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SimulationToggle from '../ui/SimulationToggle';
import AlertBell from '../alerts/AlertBell';
import { useAuthStore } from '../../store/authStore';

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

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = routeNames[location.pathname] || 'CostPilot';
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() || 'U';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 fixed top-0 right-0 left-0 lg:left-[240px] z-30 bg-[#0A0A0B]/90 backdrop-blur-xl border-b border-white/[0.07] px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-white" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <h1 className="text-xl font-display font-medium text-text-primary hidden sm:block">{title}</h1>
      </div>
      
      <div className="flex items-center gap-4 sm:gap-6">
        <SimulationToggle />
        <div className="w-[1px] h-6 bg-white/10 hidden sm:block"></div>
        <AlertBell />
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center font-bold text-xs text-text-primary border border-white/10 hover:border-brand/50 transition-colors"
          >
            {getInitials(user?.full_name)}
          </button>
          
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 bg-surface-raised border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 py-1"
              >
                <div className="px-4 py-2 border-b border-white/5 mb-1">
                  <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                  <p className="text-xs text-text-secondary truncate">{user?.email}</p>
                </div>
                
                <Link 
                  to="/settings" 
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Settings size={16} /> Settings
                </Link>
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-accent-red hover:bg-accent-red/10 transition-colors mt-1 border-t border-white/5 pt-2"
                >
                  <LogOut size={16} /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
