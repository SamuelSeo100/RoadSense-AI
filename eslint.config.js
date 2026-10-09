// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    // supabase/functions is Deno code (npm: imports), not part of the app bundle.
    ignores: ['dist/*', 'design/*', '.expo/*', 'ios/*', 'android/*', 'supabase/functions/*'],
  },
]);
