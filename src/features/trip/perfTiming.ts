import { Platform } from 'react-native';

import { tripLogService } from '@/services';
import { appVersion, updateInfo } from '@/lib/appInfo';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

/**
 * Route-search timing for the paper (perf_timings): tap → Google responses →
 * merged + ranked → list on screen. One row per search whose list was shown;
 * superseded or failed searches are not logged.
 */

interface Trace {
  cold: boolean;
  tap: number;
  /** Null when the routing service answered from its cache (no Google calls). */
  google?: number | null;
  ranked?: number;
}

/** The search in flight, then the one awaiting its first render (keyed by requestId). */
let current: Trace | null = null;
const awaitingRender = new Map<string, Trace>();
let searchesSinceLaunch = 0;

/** "samsung SM-A155F" on Android; iOS exposes no model without a native module. */
const device =
  Platform.OS === 'android'
    ? `${Platform.constants.Manufacturer} ${Platform.constants.Model}`.trim()
    : Platform.OS === 'ios'
      ? `${Platform.constants.interfaceIdiom} (model n/a)`
      : Platform.OS;
const os =
  Platform.OS === 'android'
    ? `Android ${Platform.constants.Release} (API ${Platform.Version})`
    : `${Platform.OS} ${Platform.Version}`;
const version = updateInfo.updateId
  ? `${appVersion} (update ${updateInfo.updateId.slice(0, 8)})`
  : appVersion;

/** A search starts (the user's pick / swap / retry). The first one since launch is cold. */
export function markSearchStart() {
  current = { cold: searchesSinceLaunch === 0, tap: Date.now() };
  searchesSinceLaunch++;
}

/** getRoutes resolved: `googleAt` from the result, ranked = now. */
export function markRanked(requestId: string, googleAt: number | null | undefined) {
  if (!current) return;
  awaitingRender.set(requestId, { ...current, google: googleAt ?? null, ranked: Date.now() });
  current = null;
}

/** The ranked list for `requestId` is on screen: write the row. */
export function markRendered(requestId: string) {
  const trace = awaitingRender.get(requestId);
  if (!trace || trace.ranked === undefined) return;
  awaitingRender.delete(requestId);
  if (!(useRoutlyPrefs.getState().prefs?.learnFromTrips ?? true)) return;
  const iso = (ms: number) => new Date(ms).toISOString();
  tripLogService.logPerfTiming({
    cold: trace.cold,
    t_tap: iso(trace.tap),
    t_google: trace.google == null ? null : iso(trace.google),
    t_ranked: iso(trace.ranked),
    t_rendered: iso(Date.now()),
    device,
    os,
    app_version: version,
  });
}
