import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with values that come from the environment (.env).
 *
 * GOOGLE_MAPS_API_KEY: Google Maps SDK key for the native map (Android + iOS).
 * Build-time only, never bundled into JS. Without it Android shows a blank map
 * and iOS falls back to Apple Maps.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
  if (!googleMapsApiKey) {
    console.warn(
      'GOOGLE_MAPS_API_KEY not set — map will be blank on Android and fall back to Apple Maps on iOS.',
    );
  }

  return {
    ...config,
    name: config.name ?? 'Routly',
    slug: config.slug ?? 'routly',
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey || undefined },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: googleMapsApiKey || undefined,
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Routly uses your location to plan routes from where you are and show live traffic around you.',
        },
      ],
      // On-device speech-to-text for AI Mode voice (adds RECORD_AUDIO on Android).
      [
        'expo-speech-recognition',
        {
          microphonePermission: 'Routly uses the microphone so you can speak your destination.',
          speechRecognitionPermission:
            'Routly uses speech recognition to turn what you say into a destination.',
          // Recognizers the app may bind to (Android 11+ package visibility).
          androidSpeechServicePackages: [
            'com.google.android.googlequicksearchbox',
            'com.google.android.as',
          ],
        },
      ],
      // Crash reporting. Source maps upload on EAS builds with SENTRY_AUTH_TOKEN (EAS secret).
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: 'danny-seo',
          project: 'routly-app',
        },
      ],
      // react-native-maps 1.27 needs its own plugin entry: it writes the Android
      // manifest key, and on iOS adds the Google Maps pod + GMSServices init.
      [
        'react-native-maps',
        googleMapsApiKey
          ? { androidGoogleMapsApiKey: googleMapsApiKey, iosGoogleMapsApiKey: googleMapsApiKey }
          : {},
      ],
    ],
    extra: {
      ...config.extra,
      /** True when the native Google Maps SDK is configured (LiveMap picks the provider from it). */
      googleMapsConfigured: googleMapsApiKey !== '',
      /** SENTRY_DEBUG=true: report to Sentry from dev builds too (src/lib/sentry.ts). */
      sentryDebug: process.env.SENTRY_DEBUG === 'true',
      /** EAS build profile ("preview"), set by EAS Build; unset for local builds. */
      buildProfile: process.env.EAS_BUILD_PROFILE ?? null,
    },
  };
};
