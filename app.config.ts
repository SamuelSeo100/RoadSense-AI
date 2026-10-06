import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with plugins that need secrets from the environment.
 * GOOGLE_MAPS_API_KEY: Google Maps SDK key (Android + iOS). Without it, Android
 * builds show a blank map and iOS falls back to Apple Maps.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
  return {
    ...config,
    name: config.name ?? 'Routly',
    slug: config.slug ?? 'routly',
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Routly uses your location to plan routes from where you are and show live traffic around you.',
        },
      ],
      [
        'react-native-maps',
        googleMapsApiKey
          ? { androidGoogleMapsApiKey: googleMapsApiKey, iosGoogleMapsApiKey: googleMapsApiKey }
          : {},
      ],
    ],
    extra: {
      ...config.extra,
      /** LiveMap uses the Google provider on iOS only when the SDK key is configured. */
      googleMapsOnIos: googleMapsApiKey !== '',
    },
  };
};
