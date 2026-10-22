import { create } from 'zustand';

import { isPreviewBuild } from '@/lib/appInfo';
import type { Place, Priority, RankedRoute } from '@/services';

/** "Simulate trip" exists only in dev and preview builds (never production). */
export const simulationAvailable = __DEV__ || isPreviewBuild;

/** The "Simulate trip" toggle on Routes (session only; off in production). */
export const useSimulateToggle = create<{ on: boolean; set: (on: boolean) => void }>()((set) => ({
  on: false,
  set: (on) => set({ on: on && simulationAvailable }),
}));

/** The trip being navigated, handed from Routes ("Start") to the navigation screen. */
export interface NavigationRequest {
  route: RankedRoute;
  destination: Place;
  /** The stored `trips` row (its trip_tracks row references it); null when nothing is stored. */
  tripId: string | null;
  /** Ranking the route was picked under (reroutes keep it). */
  priority: Priority;
  startedAt: number;
  /** Demo replay (dev / preview builds): fake GPS, nothing logged. */
  simulate?: boolean;
}

interface NavigationState {
  active: NavigationRequest | null;
  begin: (request: NavigationRequest) => void;
  clear: () => void;
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  active: null,
  begin: (active) => set({ active }),
  clear: () => set({ active: null }),
}));
