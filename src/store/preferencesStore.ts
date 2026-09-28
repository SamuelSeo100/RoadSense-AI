import { create } from 'zustand';

import { DEFAULT_CITY, type City } from '@/constants/cities';
import type { RoutePriority } from '@/constants/routePriorities';
import type { TransitMode } from '@/constants/transitModes';

/**
 * Travel preferences used by the ML route ranker.
 * TODO(Phase 4): persist to device storage and sync with the `profiles` row.
 */
interface PreferencesState {
  preferredModes: TransitMode[];
  priority: RoutePriority | null;
  city: City;
  setPreferences: (prefs: {
    preferredModes: TransitMode[];
    priority: RoutePriority;
    city: City;
  }) => void;
}

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  preferredModes: [],
  priority: null,
  city: DEFAULT_CITY,
  setPreferences: (prefs) => set(prefs),
}));
