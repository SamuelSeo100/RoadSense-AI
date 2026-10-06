import type { LatLng, Leg, Place } from '../types';

import { mockData } from './mockData';

/** Mock coordinates for names that aren't in the place list (saved places, trip labels). */
const extraPlaces: Place[] = [
  {
    id: 'college',
    name: 'College',
    area: 'Shivajinagar',
    location: { latitude: 18.5293, longitude: 73.8566 },
  },
  { id: 'home', name: 'Home', area: 'Pimpri', location: { latitude: 18.6235, longitude: 73.8045 } },
];

/** Default origin when the user's location is unknown (mockup: "You · Pimpri"). */
export const fallbackOrigin: Place = mockData.places[0] ?? extraPlaces[1]!;

export function findPlace(name: string): Place | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return [...mockData.places, ...extraPlaces].find(
    (p) => p.id === q || p.name.toLowerCase() === q || p.name.toLowerCase().includes(q),
  );
}

/**
 * Deterministic stand-in for unknown names, so every trip still draws
 * something plausible near central Pune.
 */
export function placeFor(name: string): Place {
  const found = findPlace(name);
  if (found) return found;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const dx = ((hash & 0xff) / 255 - 0.5) * 0.12;
  const dy = (((hash >> 8) & 0xff) / 255 - 0.5) * 0.12;
  return {
    id: `mock-${name}`,
    name,
    location: { latitude: 18.55 + dy, longitude: 73.84 + dx },
  };
}

export const toLatLng = (p: Place | LatLng): LatLng => ('location' in p ? p.location : p);

const SAMPLES = 48;

/**
 * Splits a gently curved A→B path into one polyline per leg, proportional to
 * each leg's duration. `bend` offsets the curve sideways (fraction of the
 * distance) so alternative routes don't overlap.
 */
export function withGeometry(legs: Leg[], from: LatLng, to: LatLng, bend: number): Leg[] {
  const dLat = to.latitude - from.latitude;
  const dLng = to.longitude - from.longitude;
  const control = {
    latitude: from.latitude + dLat / 2 - dLng * bend,
    longitude: from.longitude + dLng / 2 + dLat * bend,
  };
  const path: LatLng[] = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES;
    const u = 1 - t;
    return {
      latitude: u * u * from.latitude + 2 * u * t * control.latitude + t * t * to.latitude,
      longitude: u * u * from.longitude + 2 * u * t * control.longitude + t * t * to.longitude,
    };
  });

  const total = legs.reduce((sum, l) => sum + l.durationMin, 0) || 1;
  let elapsed = 0;
  return legs.map((leg) => {
    const start = Math.round((elapsed / total) * SAMPLES);
    elapsed += leg.durationMin;
    const end = Math.max(start + 1, Math.round((elapsed / total) * SAMPLES));
    return { ...leg, polyline: path.slice(start, end + 1) };
  });
}

/** Sideways offset per route, so the alternatives fan out on the map. */
export const bendFor = (index: number) => [0.04, 0.2, -0.16, 0.1, -0.08][index % 5] ?? 0;
