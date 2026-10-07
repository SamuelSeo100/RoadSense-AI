import { LruCache } from '../lruCache';
import type { DirectionsService, LatLng, SafetyService, WalkingRoute } from '../types';
import { isNight, pickSafest } from '../walkSafety';

import { googleRequest } from './googleClient';
import { decodePolyline } from './polyline';

interface ComputeRoutesResponse {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    description?: string;
    warnings?: string[];
    legs?: { steps?: unknown[] }[];
    polyline?: { encodedPolyline?: string };
  }[];
}

/** ~1 m precision: repeated requests for the same trip hit the cache. */
const keyOf = (p: LatLng) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
const waypoint = (p: LatLng) => ({ location: { latLng: p } });

/**
 * Routes API walking directions. Asks for up to 3 alternatives (minimal
 * fields), then picks the safest sensible one (see walkSafety.ts). Only the
 * chosen route's polyline is decoded, unless unsafe zones need checking.
 */
export function createGoogleDirectionsService(safety: SafetyService): DirectionsService {
  const cache = new LruCache<string, WalkingRoute>(30);
  /** Concurrent requests for the same walk (Routes screen + routing service) share one call. */
  const pending = new Map<string, Promise<WalkingRoute>>();

  return {
    walking(from, to, opts) {
      const night = isNight(opts?.at ?? new Date());
      const key = `${keyOf(from)}>${keyOf(to)}|${night ? 'night' : 'day'}`;
      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached);
      const inFlight = pending.get(key);
      if (inFlight) return inFlight;
      const request = fetchWalking(from, to, night, key, opts?.signal).finally(() =>
        pending.delete(key),
      );
      pending.set(key, request);
      return request;
    },
  };

  async function fetchWalking(
    from: LatLng,
    to: LatLng,
    night: boolean,
    key: string,
    signal: AbortSignal | undefined,
  ): Promise<WalkingRoute> {
    const [res, zones] = await Promise.all([
      googleRequest<ComputeRoutesResponse>(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          signal,
          fieldMask:
            'routes.distanceMeters,routes.duration,routes.description,routes.warnings,routes.legs.steps.distanceMeters,routes.polyline.encodedPolyline',
          body: {
            origin: waypoint(from),
            destination: waypoint(to),
            travelMode: 'WALK',
            computeAlternativeRoutes: true,
            // Indoor passages (malls, underpasses) are often closed or deserted at night.
            routeModifiers: { avoidIndoor: night },
            // Follows footpaths closely when zoomed in; walking routes are short.
            polylineQuality: 'HIGH_QUALITY',
            languageCode: 'en-IN',
            units: 'METRIC',
          },
        },
      ),
      safety.unsafeZones(from).catch(() => []),
    ]);

    const candidates = (res.routes ?? []).flatMap((r) => {
      const encoded = r.polyline?.encodedPolyline;
      if (!encoded) return [];
      return [
        {
          encoded,
          durationSec: Number.parseInt(r.duration ?? '0', 10) || 0,
          distanceMeters: r.distanceMeters ?? 0,
          warnings: r.warnings ?? [],
          steps: (r.legs ?? []).reduce((n, l) => n + (l.steps?.length ?? 0), 0),
          via: r.description,
          path: zones.length ? decodePolyline(encoded) : undefined,
        },
      ];
    });
    if (!candidates.length) throw new Error('No walking route found between these places.');

    const { best, extraSec, notes } = pickSafest(candidates, { night, zones });
    const route: WalkingRoute = {
      distanceMeters: best.distanceMeters,
      durationSec: best.durationSec,
      path: best.path ?? decodePolyline(best.encoded),
      via: best.via,
      warnings: best.warnings,
      safety: { night, extraSec, notes },
    };
    cache.set(key, route);
    return route;
  }
}
