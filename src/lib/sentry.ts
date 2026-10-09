import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

import { appVersion, updateChannel, updateInfo } from './appInfo';

/**
 * Crash reporting. Privacy rules: no PII (no email, no IP), a hashed user id
 * only, no coordinates or place names in breadcrumbs or events, no Session
 * Replay, screenshots or view hierarchy (they'd show addresses).
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const extra = (Constants.expoConfig?.extra ?? {}) as { sentryDebug?: boolean };
/** Off without a DSN, and in dev unless SENTRY_DEBUG=true at build/start time. */
export const sentryEnabled = dsn !== '' && (!__DEV__ || extra.sentryDebug === true);

/** "18.5204,73.8567", "lat 18.52 lng 73.85": anything that looks like a coordinate. */
const COORD = /-?\d{1,3}\.\d{3,}/g;
const scrub = (text: string) => text.replace(COORD, '[coord]');
/** Query strings carry search text and coordinates (Geocoding latlng=, PostgREST filters). */
const stripQuery = (url: string) => url.split('?')[0] ?? url;

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: false,
});

const beforeBreadcrumb: Sentry.ReactNativeOptions['beforeBreadcrumb'] = (crumb) => {
  switch (crumb.category) {
    // Console lines can contain anything (dev traces, library messages).
    case 'console':
      return null;
    // Touch labels are accessibility labels: "Home, Kothrud", "Routes to Westend Mall".
    case 'touch':
      return { ...crumb, message: undefined, data: undefined };
    case 'fetch':
    case 'xhr': {
      const data = { ...crumb.data };
      // Coordinates can be in the path too (Geocoding: /geocode/location/{lat},{lng}).
      if (typeof data.url === 'string') data.url = scrub(stripQuery(data.url));
      return { ...crumb, data };
    }
    case 'navigation': {
      const data = { ...crumb.data };
      for (const k of ['from', 'to'] as const) {
        if (typeof data[k] === 'string') data[k] = stripQuery(data[k] as string);
      }
      // Route params can hold place names.
      delete data.params;
      return { ...crumb, data };
    }
    default:
      return crumb.message ? { ...crumb, message: scrub(crumb.message) } : crumb;
  }
};

const beforeSend: Sentry.ReactNativeOptions['beforeSend'] = (event) => {
  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrub(ex.value);
  }
  if (event.request?.url) event.request.url = scrub(stripQuery(event.request.url));
  if (event.user) event.user = { id: event.user.id };
  return event;
};

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : (updateChannel ?? 'release'),
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // Session Replay off; no screenshots / view hierarchy (they show places).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    integrations: [navigationIntegration],
    beforeBreadcrumb,
    beforeSend,
  });
  Sentry.setTag('app_version', appVersion);
  // Which OTA update produced the event (source maps differ per update).
  Sentry.setTag('update_id', updateInfo.embedded ? 'embedded' : (updateInfo.updateId ?? 'none'));
  if (updateInfo.runtimeVersion) Sentry.setTag('runtime_version', updateInfo.runtimeVersion);
}

/** Tags events with SHA-256(user id): stable per user, never the id or email itself. */
export async function setSentryUser(userId: string | null) {
  if (!sentryEnabled) return;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `routly:${userId}`,
  );
  Sentry.setUser({ id: hash });
}

/**
 * Hidden tester action: throws a test error and reports it (caught, so a
 * release build doesn't crash). Returns the Sentry event id.
 */
export function sendTestError(): string | null {
  if (!sentryEnabled) return null;
  try {
    throw new Error('Routly Sentry test error (Profile › Settings)');
  } catch (e) {
    const id = Sentry.captureException(e);
    void Sentry.flush();
    return id;
  }
}

export { Sentry };
