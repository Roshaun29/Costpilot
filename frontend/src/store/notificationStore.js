import { create } from 'zustand';
import { getUnreadCount, getAlerts } from '../api/alerts';

export const useNotificationStore = create((set, get) => ({
  unreadCount: 0,
  alerts: [],
  intervalId: null,

  setUnreadCount: (n) => set({ unreadCount: n }),

  fetchUnread: async () => {
    try {
      const [countRes, alertsRes] = await Promise.all([
        getUnreadCount(),
        getAlerts({ limit: 5 })
      ]);
      set({ 
        unreadCount: countRes.data.data.count,
        alerts: alertsRes.data.data
      });
    } catch (err) {}
  },

  startPolling: () => {
    get().stopPolling();
    get().fetchUnread();
    
    const interval = setInterval(() => {
      get().fetchUnread();
    }, 15000); // 15s poll
    
    set({ intervalId: interval });
  },

  stopPolling: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ intervalId: null });
  }
}));
