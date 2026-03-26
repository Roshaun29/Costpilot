import { create } from 'zustand';
import { getStatus, startSimulation, stopSimulation } from '../api/simulation';
import toast from 'react-hot-toast';

export const useSimulationStore = create((set, get) => ({
  isRunning: false,
  lastTickAt: null,
  tickCount: 0,
  accountsMonitored: 0,
  intervalId: null,

  setStatus: (status) => set({
    isRunning: status.is_running,
    lastTickAt: status.last_tick_at,
    tickCount: status.tick_count,
    accountsMonitored: status.accounts_monitored
  }),

  fetchStatus: async () => {
    try {
      const res = await getStatus();
      get().setStatus(res.data.data);
    } catch (err) {
      console.error('Failed to fetch simulation status');
    }
  },

  startPolling: () => {
    get().stopPolling();
    get().fetchStatus();
    
    const interval = setInterval(() => {
      get().fetchStatus();
    }, 10000); // Check every 10s
    
    set({ intervalId: interval });
  },

  stopPolling: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ intervalId: null });
  },

  toggle: async () => {
    const state = get();
    try {
      if (state.isRunning) {
        const res = await stopSimulation();
        get().setStatus(res.data.data);
      } else {
        const res = await startSimulation();
        get().setStatus(res.data.data);
        toast.success('▶ Simulation resumed');
      }
    } catch (err) {
      toast.error('Failed to toggle simulation status');
    }
  }
}));
