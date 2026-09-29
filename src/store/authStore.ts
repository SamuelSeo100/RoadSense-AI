import { create } from 'zustand';

import type { AuthUser } from '@/features/auth/auth.types';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

/** Current session, kept in sync with the auth provider by `useAuthListener`. */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  setUser: (user) => set({ user, status: user ? 'signedIn' : 'signedOut' }),
}));
