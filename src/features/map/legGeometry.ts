import { useEffect, useMemo, useState } from 'react';

import { directionsService, type LatLng, type Leg, type Route } from '@/services';

/**
 * Real paths for estimated legs (`Leg.approximate`): short bus hops replaced by
 * a walk (straight line) and auto first/last-mile legs (borrowed walk path).
 * Fetched lazily for the selected route only, cached for the session.
 */
const cache = new Map<string, LatLng[] | 'failed'>();
const inFlight = new Set<string>();

const point = (p: LatLng) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;

function endpoints(leg: Leg): [LatLng, LatLng] | null {
  const path = leg.polyline;
  const a = path?.[0];
  const b = path?.[path.length - 1];
  return a && b ? [a, b] : null;
}

const keyOf = (leg: Leg, [a, b]: [LatLng, LatLng]) =>
  `${leg.mode === 'walk' ? 'walk' : 'drive'}|${point(a)}>${point(b)}`;

async function fetchPath(leg: Leg, [a, b]: [LatLng, LatLng]): Promise<LatLng[]> {
  if (leg.mode === 'walk') return (await directionsService.walking(a, b)).path;
  return directionsService.driving(a, b);
}

/** A path that is really just its two ends isn't geometry (offline fallbacks). */
const isReal = (path: LatLng[]) => path.length > 2;

/**
 * The route's legs with estimated legs replaced by real geometry once it has
 * loaded. Legs still `approximate` (loading, or the fetch failed) are drawn as
 * thin gray dashes and marked "~" in the step list.
 */
export function useRouteGeometry(route: Route | null): Leg[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!route) return;
    let alive = true;
    for (const leg of route.legs) {
      if (!leg.approximate) continue;
      const ends = endpoints(leg);
      if (!ends) continue;
      const key = keyOf(leg, ends);
      if (cache.has(key) || inFlight.has(key)) continue;
      inFlight.add(key);
      fetchPath(leg, ends)
        .then((path) => cache.set(key, isReal(path) ? path : 'failed'))
        .catch(() => cache.set(key, 'failed'))
        .finally(() => {
          inFlight.delete(key);
          if (alive) setVersion((v) => v + 1);
        });
    }
    return () => {
      alive = false;
    };
  }, [route]);

  return useMemo(() => {
    if (!route) return [];
    return route.legs.map((leg) => {
      if (!leg.approximate) return leg;
      const ends = endpoints(leg);
      const found = ends ? cache.get(keyOf(leg, ends)) : undefined;
      return Array.isArray(found) ? { ...leg, polyline: found, approximate: false } : leg;
    });
    // `version` re-reads the cache after each fetch lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, version]);
}
