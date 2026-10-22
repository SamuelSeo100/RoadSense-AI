import { create } from 'zustand';

import {
  busLegOf,
  tripLogService,
  type BusEtaPredictionLog,
  type ChoiceAction,
  type Priority,
  type RankedRoute,
  type Route,
  type RouteRequestLog,
  type StartTripLog,
} from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

import { currentBusEta } from './busEtaStore';

/** Bumped when a trip is stored or history is cleared, so History refetches. */
export const useHistoryVersion = create<{ version: number; bump: () => void }>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
// Trips can land late (queued offline, or left over from the last session).
tripLogService.onTripStored(() => useHistoryVersion.getState().bump());

/** "Learn from my trips": off → only trips are stored (History still works). */
const learning = () => useRoutlyPrefs.getState().prefs?.learnFromTrips ?? true;

/** Requests actually sent: choices and trips only reference these. */
const logged = new Set<string>();

/** Once per successful getRoutes result (not on priority changes). */
export function logRequest(request: RouteRequestLog) {
  if (!learning() || request.routes.length === 0) return;
  logged.add(request.id);
  tripLogService.logRequest(request);
}

/** expand (weak), book / ticket / start (strong). */
export function logChoice(
  requestId: string,
  route: RankedRoute,
  priority: Priority,
  action: ChoiceAction,
) {
  if (!learning() || !logged.has(requestId)) return;
  tripLogService.logChoice({ requestId, route, priority, action });
}

/**
 * Stores the trip for History (always, even with learning off). Never blocks.
 * Returns the trip id (null when nothing is stored: signed out / mock auth).
 */
export function startTrip(trip: Omit<StartTripLog, 'requestId'> & { requestId: string }) {
  return tripLogService.startTrip({
    ...trip,
    requestId: logged.has(trip.requestId) ? trip.requestId : null,
  });
}

/**
 * The bus ETAs shown for a route the user started (only started routes: future
 * ground truth is matched against these). Call after `startTrip`.
 */
export function logBusEtas(requestId: string, tripId: string | null, route: Pick<Route, 'legs'>) {
  if (!learning() || !logged.has(requestId)) return;
  const at = new Date();
  const predictions = route.legs.flatMap((l, legIndex): BusEtaPredictionLog[] => {
    const leg = busLegOf(l);
    return leg ? [{ requestId, tripId, legIndex, at, leg, eta: currentBusEta(leg) }] : [];
  });
  if (predictions.length > 0) tripLogService.logBusEtaPredictions(predictions);
}
