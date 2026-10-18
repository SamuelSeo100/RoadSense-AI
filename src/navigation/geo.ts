/** Small-distance geometry for navigation (metres, no dependencies). */
import type { LatLng } from '@/services/types';

const EARTH_M = 6_371_000;
const RAD = Math.PI / 180;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.latitude - a.latitude) * RAD;
  const dLng = (b.longitude - a.longitude) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthM(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceM(path[i - 1]!, path[i]!);
  return total;
}

export interface Projection {
  /** Shortest distance from the point to the path. */
  offsetM: number;
  /** Distance along the path to the closest point. */
  alongM: number;
  totalM: number;
  /** The closest point on the path. */
  point: LatLng;
}

/**
 * Closest point of `path` to `p` (flat-earth per segment: fine for the few
 * hundred metres a segment spans). Null for paths with fewer than 2 points.
 */
export function project(path: LatLng[], p: LatLng): Projection | null {
  if (path.length < 2) return null;
  const kx = Math.cos(p.latitude * RAD) * RAD * EARTH_M;
  const ky = RAD * EARTH_M;
  let best: Projection | null = null;
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const ax = (a.longitude - p.longitude) * kx;
    const ay = (a.latitude - p.latitude) * ky;
    const dx = (b.longitude - a.longitude) * kx;
    const dy = (b.latitude - a.latitude) * ky;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const x = ax + t * dx;
    const y = ay + t * dy;
    const offsetM = Math.hypot(x, y);
    const segM = Math.sqrt(len2);
    if (!best || offsetM < best.offsetM) {
      best = {
        offsetM,
        alongM: along + t * segM,
        totalM: 0,
        point: {
          latitude: a.latitude + t * (b.latitude - a.latitude),
          longitude: a.longitude + t * (b.longitude - a.longitude),
        },
      };
    }
    along += segM;
  }
  return best && { ...best, totalM: along };
}

/** The part of `path` after `alongM` metres (starting at that point). */
export function remainingPath(path: LatLng[], alongM: number): LatLng[] {
  if (path.length < 2 || alongM <= 0) return path;
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = distanceM(a, b);
    if (along + seg >= alongM) {
      const t = seg > 0 ? (alongM - along) / seg : 0;
      const cut = {
        latitude: a.latitude + t * (b.latitude - a.latitude),
        longitude: a.longitude + t * (b.longitude - a.longitude),
      };
      return [cut, ...path.slice(i)];
    }
    along += seg;
  }
  return path.slice(-1);
}
