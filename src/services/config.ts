import { env } from '@/lib/env';

/**
 * Runtime configuration for the data services. The only place they read
 * environment values from.
 */
export const serviceConfig = {
  /** Base URL of the routing/ML backend (EXPO_PUBLIC_API_URL). */
  apiBaseUrl: env.apiUrl,
  /**
   * Google key for Routes API, Places API (New) and Geocoding API calls
   * (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY). It ships inside the app bundle, so
   * restrict it in Google Cloud to those APIs and to the app's bundle ID /
   * package + SHA-1.
   */
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  /**
   * Optional SHA-1 of the Android signing cert (EXPO_PUBLIC_ANDROID_CERT_SHA1),
   * sent with Google requests when the key is restricted to Android apps.
   */
  androidCertSha1: process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 ?? '',
} as const;

export const hasGoogleMapsKey = serviceConfig.googleMapsApiKey !== '';
