const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem: 16 so `1rem` means 16dp on native, matching DESIGN.md and the web.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
