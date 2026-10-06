import * as Location from 'expo-location';

import type { LocationService } from './types';

/** Device location via expo-location (foreground only). */
export function createLocationService(): LocationService {
  return {
    async requestPermission() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied';
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
