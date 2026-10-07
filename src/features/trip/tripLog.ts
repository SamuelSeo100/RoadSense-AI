import { create } from 'zustand';

import {
  tripLogService,
  type ChoiceAction,
  type Priority,
  type RankedRoute,
  type RouteRequestLog,
  type StartTripLog,
} from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

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

/** Stores the trip for History (always, even with learning off). Never blocks. */
export function startTrip(trip: Omit<StartTripLog, 'requestId'> & { requestId: string }) {
  tripLogService.startTrip({
    ...trip,
    requestId: logged.has(trip.requestId) ? trip.requestId : null,
  });
}
