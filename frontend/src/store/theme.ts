import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeKey = 'cyberpunk' | 'midnight' | 'sakura' | 'forest' | 'sunset' | 'light';

interface ThemeState {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
}

export const DEFAULT_THEME_KEY: ThemeKey = 'cyberpunk';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME_KEY,
      setTheme: (t) => set({ theme: t }),
    }),
    { name: 'exp-theme' },
  ),
);
