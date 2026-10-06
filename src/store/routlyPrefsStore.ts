import { create } from 'zustand';

import { preferencesService, type Preferences } from '@/services';

interface RoutlyPrefsState {
  /** Null until loaded from the device. */
  prefs: Preferences | null;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Preferences>) => void;
}

/**
 * Signed-in travel preferences (default priority, toggles, Quick Launch, saved
 * places), persisted through `PreferencesService`. Updates apply instantly and
 * are written in the background.
 */
export const useRoutlyPrefs = create<RoutlyPrefsState>()((set, get) => ({
  prefs: null,
  hydrate: async () => {
    if (get().prefs) return;
    set({ prefs: await preferencesService.get() });
  },
  update: (patch) => {
    const current = get().prefs;
    if (current) set({ prefs: { ...current, ...patch } });
    preferencesService
      .update(patch)
      .then((prefs) => set({ prefs }))
      .catch(() => {
        // Keep the optimistic value; it will be retried on the next change.
      });
  },
}));
