import type { Priority, RankedRoute, Route, Vehicle } from './types';

/**
 * Reference ranking (specs/types.ts). Real ranking comes from the backend ML
 * model; this mirrors it for the mock: hide filtered vehicles, sort by the
 * chosen priority's score (lower = better), badge the first.
 */
export function rankRoutes(
  routes: Route[],
  priority: Priority,
  vehicles: Record<Vehicle, boolean>,
): RankedRoute[] {
  return routes
    .filter((r) => !r.vehicle || vehicles[r.vehicle])
    .sort((a, b) => a.score[priority] - b.score[priority])
    .map((r, i) => ({ ...r, rank: i + 1, isBest: i === 0 }));
}
