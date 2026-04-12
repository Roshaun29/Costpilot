import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // 'dark' | 'light'
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        document.documentElement.setAttribute('data-theme', next);
      },
      initTheme: () => {
        const saved = get().theme;
        document.documentElement.setAttribute('data-theme', saved);
      }
    }),
    { name: 'costpilot-theme' }
  )
);
