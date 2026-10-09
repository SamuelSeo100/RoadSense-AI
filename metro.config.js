const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// Expo's default config plus Sentry debug IDs (matches bundles to uploaded source maps).
const config = getSentryExpoConfig(__dirname);

// inlineRem: 16 so `1rem` means 16dp on native, matching DESIGN.md and the web.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
