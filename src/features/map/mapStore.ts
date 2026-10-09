import { create } from 'zustand';

import type { LatLng, Leg } from '@/services/types';

import type { TabName } from '../shell/tabs';

export interface MapRoute {
  id: string;
  legs: Leg[];
}

/**
 * What the map shows. `selection`: a route id (that route at full opacity,
 * others at 25%), `all` (every route at full opacity) or `none` (no routes).
 */
export interface MapContent {
  routes: MapRoute[];
  selection: string;
  /**
   * True once the user has picked something (a route, trip or destination):
   * the camera then frames the selection. Otherwise it stays on the user.
   */
  focused: boolean;
  /** Just the path: no mode badges (the walking-only route). */
  plain?: boolean;
  destination?: { name: string; location: LatLng };
}

export type LocationStatus = 'unknown' | 'granted' | 'denied';

interface MapState {
  /** Set by each tab while it's on screen; the shell shows the active tab's. */
  content: Partial<Record<TabName, MapContent>>;
  userLocation: LatLng | null;
  area: string | null;
  locationStatus: LocationStatus;
  /** Centre of the main map after the last pan/zoom ("Choose on map" starts here). */
  mapCenter: LatLng | null;
  setMapCenter: (center: LatLng) => void;
  setContent: (tab: TabName, content: MapContent) => void;
  setUserLocation: (pos: LatLng) => void;
  setArea: (area: string | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
}

export const useMapStore = create<MapState>()((set) => ({
  content: {},
  userLocation: null,
  area: null,
  locationStatus: 'unknown',
  mapCenter: null,
  setMapCenter: (mapCenter) => set({ mapCenter }),
  setContent: (tab, content) => set((s) => ({ content: { ...s.content, [tab]: content } })),
  setUserLocation: (userLocation) => set({ userLocation }),
  setArea: (area) => set({ area }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
}));
