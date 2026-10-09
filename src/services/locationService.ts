import * as Location from 'expo-location';

import { LocationFixError, type LocationService } from './types';

/** Device location via expo-location (foreground only). */
export function createLocationService(): LocationService {
  return {
    async requestPermission() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied';
    },

    async currentFix({ timeoutMs }) {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) throw new LocationFixError('denied', permission.canAskAgain);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new LocationFixError('timeout')), timeoutMs);
      });
      try {
        // A fresh fix (not getLastKnownPositionAsync): the cached one can be far off indoors.
        const { coords } = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
            mayShowUserSettingsDialog: true,
          }),
          timeout,
        ]);
        return {
          position: { latitude: coords.latitude, longitude: coords.longitude },
          accuracyM: coords.accuracy ?? null,
        };
      } catch (e) {
        throw e instanceof LocationFixError ? e : new LocationFixError('unavailable');
      } finally {
        clearTimeout(timer);
      }
    },

    watch(cb) {
      let subscription: Location.LocationSubscription | null = null;
      let cancelled = false;
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
        ({ coords }) => cb({ latitude: coords.latitude, longitude: coords.longitude }),
      )
        .then((sub) => {
          if (cancelled) sub.remove();
          else subscription = sub;
        })
        .catch(() => {
          // Location turned off at the OS level; keep the last known position.
        });
      return () => {
        cancelled = true;
        subscription?.remove();
      };
    },

    async areaName(pos) {
      try {
        const [address] = await Location.reverseGeocodeAsync(pos);
        return address?.district ?? address?.subregion ?? address?.city ?? null;
      } catch {
        return null;
      }
    },
  };
}
