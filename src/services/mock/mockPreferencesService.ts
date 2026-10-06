import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Preferences, PreferencesService } from '../types';

import { mockData } from './mockData';

const STORAGE_KEY = 'routly.preferences.v1';

/**
 * Preferences kept on the device. The real service will sync them with the
 * backend; until then this is the source of truth.
 */
export function createLocalPreferencesService(): PreferencesService {
  let cache: Preferences | null = null;

  const read = async (): Promise<Preferences> => {
    if (cache) return cache;
    const defaults = mockData.defaultPreferences;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
      cache = { ...defaults, ...saved, vehicles: { ...defaults.vehicles, ...saved.vehicles } };
    } catch {
      cache = defaults;
    }
    return cache;
  };

  return {
    get: read,
    async update(patch) {
      const next = { ...(await read()), ...patch };
      cache = next;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },
  };
}
