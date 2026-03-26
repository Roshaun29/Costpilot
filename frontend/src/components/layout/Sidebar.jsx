import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Cloud, TrendingUp, AlertTriangle, Bell, Sparkles, Activity, Settings, Zap, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/accounts', icon: Cloud, label: 'Cloud Accounts' },
  { path: '/costs', icon: TrendingUp, label: 'Cost Explorer' },
  { path: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
  { path: '/alerts', icon: Bell, label: 'Alerts', showBadge: true },
  { path: '/insights', icon: Sparkles, label: 'Insights' },
  { path: '/activity', icon: Activity, label: 'Activity Log' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() || 'U';

  const SidebarContent = (
    <aside className="h-screen w-[240px] bg-[#0D0D10] border-r border-white/[0.07] flex flex-col z-50 fixed left-0 top-0">
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/[0.07]">
        <Link to="/dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-brand hover:opacity-80 transition-opacity">
          <Zap size={24} fill="currentColor" />
          <span className="font-display font-bold text-xl tracking-wide">CostPilot</span>
        </Link>
        <button onClick={() => setIsOpen(false)} className="lg:hidden text-text-secondary hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group
              ${isActive 
                ? 'bg-brand/10 text-brand border-l-4 border-brand font-medium' 
                : 'text-[#8A8A9A] hover:bg-white/5 hover:text-[#F5F5F7] border-l-4 border-transparent'
              }
            `}
          >
            <item.icon size={20} className="shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.showBadge && unreadCount > 0 && (
              <span className="bg-accent-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/[0.07]">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10">
          <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center font-bold text-sm text-text-primary border border-white/10 shrink-0">
            {getInitials(user?.full_name || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.full_name}</p>
            <p className="text-xs text-text-secondary truncate">{user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors shrink-0"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block">{SidebarContent}</div>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50"
            >
              {SidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
