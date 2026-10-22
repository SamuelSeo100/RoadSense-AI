// Close mode: MainActivity handles android.intent.action.ASSIST, which makes Routly
// selectable as the default digital assistant (Settings → Default apps → Digital
// assistant app). A power-button long-press then starts it; modules/routly-assist turns
// that launch into the routly://assist deep link. DEFAULT category: the assistant role
// only counts activities that resolve with MATCH_DEFAULT_ONLY.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const ASSIST = 'android.intent.action.ASSIST';

module.exports = function withAssistIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const filters = (main['intent-filter'] ??= []);
    const has = filters.some((f) => (f.action ?? []).some((a) => a.$['android:name'] === ASSIST));
    if (!has) {
      filters.push({
        action: [{ $: { 'android:name': ASSIST } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      });
    }
    return cfg;
  });
};
