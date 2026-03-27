import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Bell, Check, Trash2, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getAlerts, markRead, markAllRead, deleteAlert } from '../api/alerts';
import { useNotificationStore } from '../store/notificationStore';

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('all'); // all, unread, email, sms, in_app
  const { fetchUnread, unreadCount } = useNotificationStore();

  useEffect(() => {
    fetchAlertList();
  }, [page, activeTab]);

  // Mark all unread elements as read internally on clear specifically
  // Use unmount effect carefully.
  useEffect(() => {
    return () => {
      // Background cleanup call to mark screen-viewed items if needed
      // Actually standard instruction: "mark all as read on unmount"
      markAllRead().then(() => fetchUnread()).catch(()=>{});
    };
  }, []);

  const fetchAlertList = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (activeTab === 'unread') params.read = false;
      if (['email', 'sms', 'in_app'].includes(activeTab)) params.channel = activeTab;

      const res = await getAlerts(params);
      setAlerts(res.data.data.items);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      toast.success('All alerts marked as read');
      fetchUnread();
      fetchAlertList();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleMarkSingle = async (id) => {
    try {
      await markRead(id);
      fetchUnread();
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    } catch (err) {}
  };

  const handleDelete = async (id) => {
    try {
      await deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      fetchUnread();
      toast.success('Alert deleted');
    } catch (err) {}
  };

  const getChannelIcon = (channel) => {
    if (channel === 'email') return <Mail size={18} className="text-[#008AD7] mt-1" />;
    if (channel === 'sms') return <MessageSquare size={18} className="text-[#4AFFD4] mt-1" />;
    return <Bell size={18} className="text-brand mt-1" />;
  };

  const tabs = [
    { id: 'all', label: 'All Alerts' },
    { id: 'unread', label: 'Unread', badge: unreadCount },
    { id: 'in_app', label: 'In-App' },
    { id: 'email', label: 'Email' },
    { id: 'sms', label: 'SMS' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Notification Center</h1>
          <p className="text-text-secondary text-sm">Review dispatch logs across all communication channels.</p>
        </div>
        <Button variant="secondary" icon={Check} onClick={handleMarkAll} disabled={unreadCount === 0}>
          Mark All Read
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 pb-px overflow-x-auto custom-scrollbar">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setPage(1); }}
            className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === t.id ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="bg-accent-red text-white text-[10px] px-2 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          Array(5).fill(0).map((_, i) => <Card key={i} className="h-20"><div className="shimmer h-full w-full rounded-xl" /></Card>)
        ) : alerts.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <Bell size={32} className="mx-auto text-white/20 mb-4" />
            <p className="text-text-secondary">No alerts found in this category.</p>
          </div>
        ) : (
          alerts.map(alert => (
            <Card key={alert.id} className={`p-4 transition-colors flex gap-4 ${!alert.read ? 'bg-white/[0.03] border-white/10 border-l-2 border-l-brand' : 'bg-transparent border-white/[0.05] opacity-80'}`} onClick={() => !alert.read && handleMarkSingle(alert.id)}>
              <div className="shrink-0">
                {getChannelIcon(alert.channel)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${!alert.read ? 'text-white font-medium' : 'text-text-secondary'}`}>
                  {alert.message}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[11px] text-text-secondary font-mono tracking-wider">
                    {formatDistanceToNow(new Date(alert.sent_at), { addSuffix: true })}
                  </span>
                  {alert.anomaly_id && (
                    <Link to={`/anomalies`} state={{ selectedAnomalyId: alert.anomaly_id }} className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1">
                      View Anomaly <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); handleDelete(alert.id); }} className="p-2 text-text-secondary hover:text-accent-red hover:bg-white/5 rounded-lg" title="Delete Log">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))
        )}

        {total > page * 20 && (
          <div className="pt-6 flex justify-center">
            <Button variant="secondary" onClick={() => setPage(p => p + 1)}>Load More History</Button>
          </div>
        )}
      </div>
    </div>
  );
}
