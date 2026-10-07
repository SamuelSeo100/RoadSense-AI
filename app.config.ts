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
    },
  };
};
