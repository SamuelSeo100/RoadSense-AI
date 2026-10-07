import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import { encodePolyline } from '../google/polyline';
import { PRIORITIES, type LatLng, type Mode, type Route, type TripLogService } from '../types';
import { isNight } from '../walkSafety';

import { toDbPriority } from './dbPriority';
import { createWriteQueue } from './writeQueue';

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

/**
 * Supabase-backed logging; writes only with a signed-in session. Rows carry a
 * client-made id (a retried insert that already landed is a no-op) and the
 * user id at the time, so a queued write never lands under another account.
 */
export function createSupabaseTripLogService(supabase: SupabaseClient): TripLogService {
  let userId: string | null = null;
  supabase.auth.onAuthStateChange((_event, session) => {
    userId = session?.user.id ?? null;
  });
  const tripListeners = new Set<() => void>();

  const queue = createWriteQueue({
    storageKey: 'routly.tripLog.queue',
    async run({ table, row }) {
      const { data } = await supabase.auth.getSession();
      const current = data.session?.user.id;
      // Signed out (or the session isn't restored yet): wait. No code = retry later.
      if (!current) return { error: { message: 'no session' } };
      if (current !== row.user_id) return { error: { code: 'other_user', message: 'other user' } };
      return supabase.from(table).insert(row);
    },
    onWritten({ table }) {
      if (table === 'trips') tripListeners.forEach((l) => l());
    },
  });

  /** Queues the row for the signed-in user; skipped without a session. */
  const write = (table: string, row: Record<string, unknown> & { id?: string }) => {
    if (!userId) return;
    queue.submit(table, { id: Crypto.randomUUID(), ...row, user_id: userId });
  };

  return {
    logRequest(req) {
      const { weekday, hour } = istParts(req.at);
      write('route_requests', {
        id: req.id,
        created_at: req.at.toISOString(),
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
      });
    },

    logChoice({ requestId, route, priority, action }) {
      write('route_choices', {
        request_id: requestId,
        chosen_route_id: route.id,
        chosen_rank: route.rank,
        priority: toDbPriority(priority),
        action,
        created_at: new Date().toISOString(),
      });
    },

    startTrip(trip) {
      write('trips', {
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
      });
    },

    onTripStored(listener) {
      tripListeners.add(listener);
      return () => tripListeners.delete(listener);
    },

    clearPending() {
      queue.clear();
    },
  };
}

/** Mock-auth mode: nothing is stored. */
export function createNoopTripLogService(): TripLogService {
  return {
    logRequest() {},
    logChoice() {},
    startTrip() {},
    onTripStored: () => () => {},
    clearPending() {},
  };
}
