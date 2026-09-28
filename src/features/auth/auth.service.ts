import type { SignupValues } from './schemas';

/**
 * Auth service contract. Screens and hooks depend only on this interface so the
 * provider (Supabase, mock) can be swapped.
 *
 * TODO(Phase 4): Supabase implementation + EXPO_PUBLIC_AUTH_MOCK switch.
 */
export type SignUpInput = Omit<SignupValues, 'confirmPassword' | 'acceptTerms'>;

export interface AuthService {
  /** `phone` is 10 digits without +91. */
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  /** Creates the account + profile row, then sends an OTP to verify the phone. */
  signUp(input: SignUpInput): Promise<void>;
  signOut(): Promise<void>;
}

export class AuthNotConnectedError extends Error {
  constructor() {
    super('Sign-in isn’t connected yet — it arrives with the auth wiring.');
    this.name = 'AuthNotConnectedError';
  }
}

/** Temporary UI-only implementation: sign-up and phone OTP "succeed" so the flow can be previewed. */
const previewAuthService: AuthService = {
  async sendOtp() {},
  async verifyOtp() {
    throw new AuthNotConnectedError();
  },
  async signInWithEmail() {
    throw new AuthNotConnectedError();
  },
  async signInWithGoogle() {
    throw new AuthNotConnectedError();
  },
  async signUp() {},
  async signOut() {},
};

export const authService: AuthService = previewAuthService;
