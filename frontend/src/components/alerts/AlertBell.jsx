import { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Mail, MessageSquare, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { markRead } from '../../api/alerts';

export default function AlertBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();
  const { unreadCount, alerts, fetchUnread } = useNotificationStore();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (channel) => {
    if (channel === 'email') return <Mail size={16} />;
    if (channel === 'sms') return <MessageSquare size={16} />;
    return <AlertTriangle size={16} />;
  };

  const handleAlertClick = async (alert) => {
    setIsOpen(false);
    // Mark as read if unread
    if (!alert.read) {
      try {
        await markRead(alert.id);
        fetchUnread();
      } catch (e) {}
    }
    // Navigate to alerts page
    navigate('/alerts');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-accent-red rounded-full border border-bg"
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-surface-raised border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-medium text-sm">Recent Alerts</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-accent-red/20 text-accent-red px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} New
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="p-6 text-center text-text-secondary text-sm">
                  No alerts yet
                </div>
              ) : (
                alerts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleAlertClick(a)}
                    className={`w-full text-left p-4 flex gap-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!a.read ? 'bg-white/[0.02]' : ''}`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${!a.read ? 'bg-accent-red/20 text-accent-red' : 'bg-white/5 text-text-secondary'}`}>
                      {getIcon(a.channel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed line-clamp-2 ${!a.read ? 'text-white' : 'text-text-secondary'}`}>
                        {a.message}
                      </p>
                      <span className="text-[10px] text-text-secondary mt-1 block">
                        {formatDistanceToNow(new Date(a.sent_at), { addSuffix: true })}
                      </span>
                    </div>
                    {!a.read && (
                      <div className="w-2 h-2 rounded-full bg-accent-red shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="p-2 border-t border-white/5 bg-black/20">
              <button
                onClick={() => { setIsOpen(false); navigate('/alerts'); }}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-brand hover:underline py-1.5 transition-colors"
              >
                View All Alerts <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
