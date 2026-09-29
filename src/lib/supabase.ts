import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';
import { secureStorage } from './secureStorage';

/** Null in mock mode (no Supabase config); callers go through the auth service. */
export const supabase: SupabaseClient | null = env.authMock
  ? null
  : createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
