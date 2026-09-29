import { AuthError, type AuthService, type AuthUser } from '../auth.types';

/**
 * In-memory auth for demos and teammates without Supabase keys
 * (EXPO_PUBLIC_AUTH_MOCK=true). Nothing leaves the device; state resets on reload.
 */
export function createMockAuthService(): AuthService {
  const accounts = new Map<string, { password: string; user: AuthUser }>();
  const listeners = new Set<(user: AuthUser | null) => void>();
  let current: AuthUser | null = null;

  const setCurrent = (user: AuthUser | null) => {
    current = user;
    listeners.forEach((l) => l(user));
  };

  return {
    async getCurrentUser() {
      return current;
    },

    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async signInWithEmail(email, password) {
      const account = accounts.get(email.toLowerCase());
      // Unknown emails are accepted so the demo works without signing up first.
      if (account && account.password !== password) {
        throw new AuthError('Incorrect email or password.');
      }
      setCurrent(account?.user ?? { id: `mock-${email}`, email, name: email.split('@')[0] ?? '' });
    },

    async signUp({ email, password, name }) {
      const key = email.toLowerCase();
      if (accounts.has(key)) {
        throw new AuthError('An account with this email already exists. Try logging in.');
      }
      const user: AuthUser = { id: `mock-${key}`, email, name };
      accounts.set(key, { password, user });
      setCurrent(user);
      return { needsEmailConfirmation: false };
    },

    async signInWithGoogle() {
      setCurrent({ id: 'mock-google', email: 'demo.user@gmail.com', name: 'Demo User' });
    },

    async signOut() {
      setCurrent(null);
    },
  };
}
