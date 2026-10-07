import type { DirectionsService } from '../types';
import { isNight } from '../walkSafety';

/** Average walking speed, m/s (≈5 km/h). */
const WALK_SPEED = 1.4;

/** Offline stand-in when no Google key is configured: a straight line. */
export function createMockDirectionsService(): DirectionsService {
  return {
    async walking(from, to, opts) {
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(to.latitude - from.latitude);
      const dLng = toRad(to.longitude - from.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
      const distanceMeters = Math.round(2 * R * Math.asin(Math.sqrt(a)));
      return {
        distanceMeters,
        durationSec: Math.round(distanceMeters / WALK_SPEED),
        path: [from, to],
        warnings: ['Offline estimate: straight line, not a real walking path.'],
        safety: { night: isNight(opts?.at ?? new Date()), extraSec: 0, notes: [] },
      };
    },
  };
}
