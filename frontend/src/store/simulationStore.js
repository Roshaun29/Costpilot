import { create } from 'zustand';
import { getStatus, startSimulation, stopSimulation } from '../api/simulation';
import toast from 'react-hot-toast';

export const useSimulationStore = create((set, get) => ({
  isRunning: false,
  lastTickAt: null,
  tickCount: 0,
  accountsMonitored: 0,
  intervalId: null,

  setStatus: (status) => {
    const wasRunning = get().isRunning;
    const isRunningNow = status.is_running;
    
    set({
      isRunning: isRunningNow,
      lastTickAt: status.last_tick_at,
      tickCount: status.tick_count,
      accountsMonitored: status.accounts_monitored
    });

    // Auto-manage polling interval based on status
    if (!wasRunning && isRunningNow) {
      get().startAutoSync();
    } else if (wasRunning && !isRunningNow) {
      get().stopAutoSync();
    }
  },

  fetchStatus: async () => {
    try {
      const res = await getStatus();
      get().setStatus(res.data.data);
    } catch (err) {
      console.error('Failed to fetch simulation status');
    }
  },

  startAutoSync: () => {
    const { intervalId } = get();
    if (intervalId) return; // Already polling
    
    const interval = setInterval(() => {
      get().fetchStatus();
    }, 10000); // Check every 10s
    
    set({ intervalId: interval });
  },

  stopAutoSync: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ intervalId: null });
  },

  // Called from App.jsx initialization
  initializeSync: async () => {
    await get().fetchStatus();
  },

  // Called by useLiveData on incoming WS events
  handleWsEvent: (data) => {
    if (data.type === 'simulation_paused') {
      set({ isRunning: false });
      get().stopAutoSync();
    } else if (data.type === 'live_metrics') {
      const previousState = get().isRunning;
      set({ isRunning: true, tickCount: data.tick, lastTickAt: new Date().toISOString() });
      if (!previousState) get().startAutoSync();
    }
  },

  toggle: async () => {
    const state = get();
    try {
      if (state.isRunning) {
        await stopSimulation();
        toast.success('⏹ Simulation stopped');
      } else {
        await startSimulation();
        toast.success('▶ Simulation started');
      }
      // Refresh status from server after toggle
      await get().fetchStatus();
    } catch (err) {
      toast.error('Failed to toggle simulation status');
    }
  }
}));
