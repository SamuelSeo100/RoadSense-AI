import { create } from 'zustand';

import type { Place, Priority, RankedRoute } from '@/services';

/** The trip being navigated, handed from Routes ("Start") to the navigation screen. */
export interface NavigationRequest {
  route: RankedRoute;
  destination: Place;
  /** The stored `trips` row (its trip_tracks row references it); null when nothing is stored. */
  tripId: string | null;
  /** Ranking the route was picked under (reroutes keep it). */
  priority: Priority;
  startedAt: number;
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
