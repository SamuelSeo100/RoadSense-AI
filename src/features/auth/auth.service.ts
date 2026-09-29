import { supabase } from '@/lib/supabase';

import type { AuthService } from './auth.types';
import { createMockAuthService } from './services/mockAuthService';
import { createSupabaseAuthService } from './services/supabaseAuthService';

export * from './auth.types';

/** The app's auth provider: Supabase, or the in-memory mock when EXPO_PUBLIC_AUTH_MOCK is on. */
export const authService: AuthService = supabase
  ? createSupabaseAuthService(supabase)
  : createMockAuthService();

export const isMockAuth = supabase === null;
