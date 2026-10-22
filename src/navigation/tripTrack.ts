/**
 * The `trip_tracks` row for a navigated trip: predicted vs actual times per
 * leg (ground truth for the research paper). Only our derived numbers: no
 * Google response bodies. GPS points only with research consent.
 */
import type { RouteDataSource } from '@/services/types';

import type { Fix, StepRecord } from './engine';
import type { NavStep } from './steps';

export type EndReason = 'arrived' | 'user_ended' | 'abandoned';

/** One kept GPS point: seconds since the trip started, 5 dp (~1 m). */
export interface TrackPoint {
  s: number;
  lat: number;
  lng: number;
  /** Accuracy in metres, rounded. */
  acc: number | null;
}

export const TRACK_EVERY_MS = 15_000;

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Keeps the first fix, then one per 15 s. */
export class TrackRecorder {
  readonly points: TrackPoint[] = [];
  private lastKeptAt = -Infinity;

  constructor(private readonly startedAt: number) {}

  /** True when the fix was kept. */
  add(fix: Fix): boolean {
    if (fix.t - this.lastKeptAt < TRACK_EVERY_MS) return false;
    this.lastKeptAt = fix.t;
    this.points.push({
      s: Math.max(0, Math.round((fix.t - this.startedAt) / 1000)),
      lat: round5(fix.lat),
      lng: round5(fix.lng),
      acc: fix.accuracy === null ? null : Math.round(fix.accuracy),
    });
    return true;
  }
}

export interface TripTrackLeg {
  /** 0 = the route the trip started on, +1 per reroute. */
  version: number;
  /**
   * Position in the route's legs. Version 0 matches bus_eta_predictions.leg_index
   * (join on trip_id + leg_index).
   */
  leg_index: number;
  kind: NavStep['kind'];
  mode: string;
  line: string | null;
  source: RouteDataSource;
  predicted_s: number;
  /** Null when the leg wasn't finished (rerouted, ended or abandoned on it). */
  actual_s: number | null;
  scheduled_dep: string | null;
  /** When the leg started / ended (ISO); end null while unfinished. */
  actual_start: string | null;
  actual_end: string | null;
  actual_board_time: string | null;
  /** Rides ended by GPS: closest approach to the alighting stop. */
  actual_alight_time: string | null;
  /** Platform wait: reaching the boarding stop → boarding detected. */
  wait_s: number | null;
  /** How the leg ended: GPS, "Next leg" by hand, or not ended (null). */
  ended_by: 'gps' | 'manual' | null;
}

export interface TripTrackRow {
  id: string;
  trip_id: string;
  route_source: RouteDataSource;
  started_at: string;
  ended_at: string;
  completed: boolean;
  end_reason: EndReason;
  predicted_duration_s: number;
  actual_duration_s: number;
  predicted_fare: number;
  reroute_count: number;
  off_route_count: number;
  legs: TripTrackLeg[];
  track_points: TrackPoint[] | null;
}

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
const secs = (ms: number) => Math.max(0, Math.round(ms / 1000));

/**
 * Per leg, in travel order: every leg of the final route version, plus the
 * legs of earlier versions that were started before a reroute.
 */
export function legsOf(
  stepsByVersion: NavStep[][],
  history: readonly StepRecord[],
): TripTrackLeg[] {
  const last = stepsByVersion.length - 1;
  const out: TripTrackLeg[] = [];
  stepsByVersion.forEach((steps, version) => {
    const legIndexes = [...new Set(steps.map((s) => s.legIndex))];
    for (const legIndex of legIndexes) {
      const legSteps = steps.filter((s) => s.legIndex === legIndex);
      const recs = history.filter((r) => r.version === version && r.step.legIndex === legIndex);
      if (version !== last && recs.length === 0) continue;
      const first = legSteps[0]!;
      const lastStep = legSteps[legSteps.length - 1]!;
      // A leg ended by hand ("Next leg") may stop before its last step.
      const manual = recs.find((r) => r.manual);
      const end = manual ?? recs.find((r) => r.step.id === lastStep.id);
      const finished = end?.endedAt !== undefined && !end.interrupted;
      const start = recs[0]?.startedAt;
      const ride = recs.find((r) => r.step.kind === 'transit');
      out.push({
        version,
        leg_index: legIndex,
        kind: first.kind,
        mode: first.transit?.mode ?? first.legMode,
        line: first.transit?.line ?? null,
        source: first.source,
        predicted_s: legSteps.reduce((sum, s) => sum + s.predictedDurationS, 0),
        actual_s: finished && start !== undefined ? secs(end!.endedAt! - start) : null,
        scheduled_dep: first.transit?.scheduledDep ?? null,
        actual_start: iso(start),
        actual_end: finished ? iso(end!.endedAt) : null,
        actual_board_time: iso(ride?.boardedAt),
        actual_alight_time: iso(ride?.alightedAt),
        wait_s: ride?.boardedAt !== undefined ? secs(ride.boardedAt - ride.startedAt) : null,
        ended_by: finished ? (end!.manual ? 'manual' : 'gps') : null,
      });
    }
  });
  return out;
}

export function buildTripTrack(input: {
  id: string;
  tripId: string;
  routeSource: RouteDataSource;
  startedAt: number;
  endedAt: number;
  endReason: EndReason;
  predictedDurationS: number;
  predictedFare: number;
  rerouteCount: number;
  offRouteCount: number;
  stepsByVersion: NavStep[][];
  history: readonly StepRecord[];
  /** Null without research consent: then no GPS leaves the device. */
  trackPoints: TrackPoint[] | null;
}): TripTrackRow {
  return {
    id: input.id,
    trip_id: input.tripId,
    route_source: input.routeSource,
    started_at: new Date(input.startedAt).toISOString(),
    ended_at: new Date(input.endedAt).toISOString(),
    completed: input.endReason === 'arrived',
    end_reason: input.endReason,
    predicted_duration_s: Math.round(input.predictedDurationS),
    actual_duration_s: secs(input.endedAt - input.startedAt),
    predicted_fare: Math.round(input.predictedFare),
    reroute_count: input.rerouteCount,
    off_route_count: input.offRouteCount,
    legs: legsOf(input.stepsByVersion, input.history),
    track_points: input.trackPoints,
  };
}
