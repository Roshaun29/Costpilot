import { create } from 'zustand';
import { getMe } from '../api/auth';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    localStorage.setItem('costpilot_token', token);
    set({ token, user, isAuthenticated: true });
  },

  login: (token, user) => {
    localStorage.setItem('costpilot_token', token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('costpilot_token');
    set({ token: null, user: null, isAuthenticated: false });
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
  },

  updateUser: (data) => set((state) => ({ user: { ...state.user, ...data } })),

  initialize: async () => {
    const token = localStorage.getItem('costpilot_token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    try {
      // Setup temporary token for axios interceptor
      set({ token });
      const res = await getMe();
      set({ user: res.data.data, isAuthenticated: true });
    } catch (err) {
      localStorage.removeItem('costpilot_token');
      set({ token: null, user: null, isAuthenticated: false });
    }
  }
}));
