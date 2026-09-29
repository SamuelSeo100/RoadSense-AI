import type { City } from '@/constants/cities';
import type { RoutePriority } from '@/constants/routePriorities';
import type { TransitMode } from '@/constants/transitModes';

/** Provider-independent signed-in user. */
export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  /** 10 digits without +91, or empty. */
  phone: string;
  preferredModes: TransitMode[];
  priority: RoutePriority;
  city: City;
}

export interface SignUpResult {
  /** True when the provider requires clicking an email link before the first login. */
  needsEmailConfirmation: boolean;
}

/**
 * Auth contract. Screens, hooks and stores depend only on this, so the provider
 * (Supabase, mock) can be swapped without touching UI code.
 */
export interface AuthService {
  getCurrentUser(): Promise<AuthUser | null>;
  /** Returns an unsubscribe function. */
  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  /**
   * Google OAuth in the system browser (works in Expo Go and on web). Creates the
   * account on first use. Resolves without signing in if the user cancels.
   */
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

/** Error with a message that is safe and friendly to show in the UI. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
