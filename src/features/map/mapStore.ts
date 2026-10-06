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
  destination?: { name: string; location: LatLng };
}

export type LocationStatus = 'unknown' | 'granted' | 'denied';

interface MapState {
  /** Set by each tab while it's on screen; the shell shows the active tab's. */
  content: Partial<Record<TabName, MapContent>>;
  userLocation: LatLng | null;
  area: string | null;
  locationStatus: LocationStatus;
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
  setContent: (tab, content) => set((s) => ({ content: { ...s.content, [tab]: content } })),
  setUserLocation: (userLocation) => set({ userLocation }),
  setArea: (area) => set({ area }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
}));
