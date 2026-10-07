import type { LatLng, UnsafeZone } from './types';

/** Night-time rules apply 20:00–06:00 local time. */
export const isNight = (at: Date) => at.getHours() >= 20 || at.getHours() < 6;

export interface WalkCandidate {
  durationSec: number;
  distanceMeters: number;
  warnings: string[];
  /** Number of turn-by-turn steps (fewer per km ≈ stays on main roads). */
  steps: number;
  /** Only needed when there are unsafe zones to check. */
  path?: LatLng[];
}

const EARTH_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
/** Fast equirectangular distance; accurate to <0.5% at city scale. */
function metersBetween(a: LatLng, b: LatLng) {
  const x = toRad(b.longitude - a.longitude) * Math.cos(toRad((a.latitude + b.latitude) / 2));
  const y = toRad(b.latitude - a.latitude);
  return Math.hypot(x, y) * EARTH_M;
}

const crosses = (path: LatLng[], zone: UnsafeZone) =>
  path.some((p) => metersBetween(p, zone.center) <= zone.radiusM);

/**
 * Picks the safest sensible walking route. Lower score wins:
 * - base: walking time
 * - each provider warning (e.g. missing sidewalks): +15%, doubled at night
 * - each unsafe zone crossed: +100% (night-only zones count only at night)
 * - at night, turns beyond ~4 per km: +3% each (favours main, busier roads)
 */
export function pickSafest<T extends WalkCandidate>(
  candidates: T[],
  { night, zones }: { night: boolean; zones: UnsafeZone[] },
) {
  const fastest = Math.min(...candidates.map((c) => c.durationSec));
  const activeZones = zones.filter((z) => night || !z.nightOnly);

  const scored = candidates.map((c) => {
    let factor = 1 + c.warnings.length * (night ? 0.3 : 0.15);
    const hits = c.path ? activeZones.filter((z) => crosses(c.path ?? [], z)) : [];
    factor += hits.length;
    if (night) {
      const km = Math.max(c.distanceMeters / 1000, 0.5);
      factor += Math.max(0, c.steps / km - 4) * 0.03;
    }
    return { candidate: c, score: c.durationSec * factor, hits };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  if (!best) throw new Error('No walking route found between these places.');

  const extraSec = best.candidate.durationSec - fastest;
  const notes: string[] = [];
  if (night) notes.push('Night route: favours main roads and avoids indoor passages.');
  if (extraSec > 60) {
    notes.push(`Safer choice: ${Math.round(extraSec / 60)} min longer than the fastest route.`);
  }
  const avoided = activeZones.filter(
    (z) => !best.hits.includes(z) && scored.some((s) => s.hits.includes(z)),
  );
  for (const z of avoided) notes.push(`Avoids ${z.reason}.`);
  for (const z of best.hits) notes.push(`Passes near ${z.reason}. Take care.`);
  return { best: best.candidate, extraSec: Math.max(0, extraSec), notes };
}
