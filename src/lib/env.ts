/**
 * Typed access to EXPO_PUBLIC_* variables (see .env.example).
 * Expo inlines these at build time, so each must be read as a literal
 * `process.env.EXPO_PUBLIC_…` expression.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  /** Optional: attributes Uber deep links to our app. */
  uberClientId: process.env.EXPO_PUBLIC_UBER_CLIENT_ID ?? '',
  /** Ola XAPP token, required by Ola's web deep link (`utm_source`). */
  olaXappToken: process.env.EXPO_PUBLIC_OLA_XAPP_TOKEN ?? '',
  /** Fake auth when asked for, or when Supabase isn't configured (e.g. fresh clone). */
  authMock: process.env.EXPO_PUBLIC_AUTH_MOCK === 'true' || !supabaseUrl || !supabasePublishableKey,
} as const;
