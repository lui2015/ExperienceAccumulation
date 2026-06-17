import { create } from 'zustand';
import type { UserOut } from '@/api/types';

interface AuthState {
  user: UserOut | null;
  setUser: (u: UserOut | null) => void;
  isOwner: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  isOwner: () => get().user?.role === 'owner',
}));
