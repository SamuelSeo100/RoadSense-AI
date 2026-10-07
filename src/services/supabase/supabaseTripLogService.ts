import type { SupabaseClient } from '@supabase/supabase-js';

import { encodePolyline } from '../google/polyline';
import { PRIORITIES, type LatLng, type Mode, type Route, type TripLogService } from '../types';
import { isNight } from '../walkSafety';

import { toDbPriority } from './dbPriority';
import { createWriteQueue, type WriteResult } from './writeQueue';

/** ~11 m: what we store for any coordinate (the columns enforce it too). */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const round4Point = (p: LatLng): LatLng => ({
  latitude: round4(p.latitude),
  longitude: round4(p.longitude),
});

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Weekday (0 = Sunday) and hour in India time, whatever the device zone. */
export function istParts(at: Date) {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  return { weekday: ist.getUTCDay(), hour: ist.getUTCHours() };
}

/** The mode with the most minutes (ties: the first). */
export function dominantMode(route: Pick<Route, 'legs'>): Mode {
  const minutes = new Map<Mode, number>();
  for (const leg of route.legs)
    minutes.set(leg.mode, (minutes.get(leg.mode) ?? 0) + leg.durationMin);
  let best: Mode = route.legs[0]?.mode ?? 'walk';
  for (const [mode, min] of minutes) if (min > (minutes.get(best) ?? 0)) best = mode;
  return best;
}

/** Trip snapshot: legs without full polylines, one encoded (4 dp) string each. */
function routeSnapshot(route: Route) {
  return {
    id: route.id,
    name: route.name,
    legs: route.legs.map((l) => ({
      mode: l.mode,
      label: l.label,
      minutes: l.durationMin,
      cost_inr: l.costInr ?? null,
      approximate: l.approximate ?? false,
      polyline:
        l.polyline && l.polyline.length > 1 ? encodePolyline(l.polyline.map(round4Point)) : null,
    })),
  };
}

/** Supabase-backed logging; writes only with a signed-in session. */
export function createSupabaseTripLogService(supabase: SupabaseClient): TripLogService {
  const queue = createWriteQueue();

  /** Skips (as a success) when there's no session: nothing to store for. */
  const asUser = (write: () => PromiseLike<WriteResult>) => async (): Promise<WriteResult> => {
    const { data } = await supabase.auth.getSession();
    return data.session ? write() : { error: null };
  };

  return {
    logRequest(req) {
      const { weekday, hour } = istParts(req.at);
      void queue.submit(
        'route_requests',
        asUser(() =>
          supabase.from('route_requests').insert({
            id: req.id,
            from_name: req.from.name,
            from_lat: round4(req.from.location.latitude),
            from_lng: round4(req.from.location.longitude),
            to_name: req.to.name,
            to_lat: round4(req.to.location.latitude),
            to_lng: round4(req.to.location.longitude),
            priority: toDbPriority(req.priority),
            is_night: isNight(req.at),
            weekday,
            hour,
            options: req.routes.map((r) => ({
              id: r.id,
              name: r.name,
              modes: r.legs.map((l) => l.mode),
              duration_min: r.durationMin,
              cost_inr: r.costInr,
              walking_km: r.walkingKm,
              transfers: r.transfers,
              traffic: r.traffic,
              rank: r.rank,
              score: Object.fromEntries(
                PRIORITIES.map((p) => [toDbPriority(p), Math.round(r.score[p] * 1000) / 1000]),
              ),
            })),
          }),
        ),
      );
    },

    logChoice({ requestId, route, priority, action }) {
      void queue.submit(
        'route_choices',
        asUser(() =>
          supabase.from('route_choices').insert({
            request_id: requestId,
            chosen_route_id: route.id,
            chosen_rank: route.rank,
            priority: toDbPriority(priority),
            action,
          }),
        ),
      );
    },

    startTrip(trip) {
      return queue.submit(
        'trips',
        asUser(() =>
          supabase.from('trips').insert({
            request_id: trip.requestId,
            started_at: trip.at.toISOString(),
            route: routeSnapshot(trip.route),
            from_name: trip.from,
            to_name: trip.to,
            mode: dominantMode(trip.route),
            mode_label: trip.route.name,
            duration_min: trip.route.durationMin,
            cost_inr: Math.round(trip.route.costInr),
            cab_equivalent_inr:
              trip.cabEquivalentInr === null ? null : Math.round(trip.cabEquivalentInr),
          }),
        ),
      );
    },
  };
}

/** Mock-auth mode: nothing is stored. */
export function createNoopTripLogService(): TripLogService {
  return {
    logRequest() {},
    logChoice() {},
    startTrip: () => Promise.resolve(false),
  };
}
