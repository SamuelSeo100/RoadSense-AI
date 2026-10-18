/**
 * Turn-by-turn state machine. Pure TypeScript (no React / Expo): feed it GPS
 * fixes, act on the events it returns. Times are the fixes' own clocks (ms),
 * so tests can replay a trip.
 *
 * - Advance when within 20 m of the step's end (35 m when accuracy > 25 m;
 *   150 m for a ride, station coordinates are approximate).
 * - Off route: > 50 m (walk) / 100 m (road) from the step for 15 s in a
 *   row. Never during rides (trains leave the road graph).
 * - Ride boarding: moving > 15 km/h near the line. "Get off at the next
 *   stop" once past the stop before the alighting one, or 600 m out when
 *   the stops aren't known.
 * - Reroute: asked for on off-route, at most once per 30 s.
 * - Arrival: within 50 m of the destination.
 */
import { distanceM, pathLengthM, project, remainingPath } from './geo';
import type { LatLng, NavStep } from './steps';

export interface Fix {
  lat: number;
  lng: number;
  /** Metres; null when unknown. */
  accuracy: number | null;
  /** m/s; null (or negative, iOS) when unknown. */
  speed: number | null;
  /** Degrees from north; null when unknown. */
  heading: number | null;
  /** ms since epoch. */
  t: number;
}

export const navConfig = {
  advanceM: 20,
  advanceLowAccuracyM: 35,
  lowAccuracyM: 25,
  rideAdvanceM: 150,
  offRouteM: { walk: 50, drive: 100, two_wheeler: 100 },
  offRouteForMs: 15_000,
  /** Fixes worse than this neither start nor clear an off-route episode. */
  offRouteMaxAccuracyM: 100,
  /** Near the next ride's boarding point, a walk never goes off route (station forecourts). */
  nearBoardingM: 100,
  boardSpeedKmh: 15,
  /** Timetable lines are straight station-to-station segments: be generous. */
  boardLineM: 250,
  alightNoStopsM: 600,
  /** "Past the stop before": within this of it along the line. */
  alightStopSlackM: 100,
  approachTurnM: 100,
  /** Steps shorter than this get no "in 100 m" warning (it would come at once). */
  approachMinStepM: 150,
  arriveM: 50,
  rerouteEveryMs: 30_000,
} as const;

export type NavEvent =
  | { type: 'stepStart'; index: number; step: NavStep; t: number }
  /** ~100 m before the end of a walk / road step: `next` is the turn coming up. */
  | { type: 'approachTurn'; index: number; next: NavStep; t: number }
  | { type: 'boarded'; index: number; t: number }
  | { type: 'alightSoon'; index: number; stop: string; t: number }
  | { type: 'offRoute'; index: number; distanceM: number; t: number }
  /** Compute a new route from `from`, then call `replaceSteps`. */
  | { type: 'reroute'; from: LatLng; t: number }
  | { type: 'arrived'; t: number };

/** What happened on one step (per route version: a reroute starts a new one). */
export interface StepRecord {
  step: NavStep;
  /** 0 = the route the trip started on, +1 per reroute. */
  version: number;
  startedAt: number;
  endedAt?: number;
  /** Rides: when boarding was detected. */
  boardedAt?: number;
  /** Ended by a reroute rather than reaching its end. */
  interrupted?: boolean;
}

export type NavStatus = 'idle' | 'navigating' | 'arrived' | 'ended';

const KMH = 3.6;

export class NavigationEngine {
  private steps: NavStep[];
  private idx = 0;
  private version = 0;
  private status_: NavStatus = 'idle';
  private records: StepRecord[] = [];
  private lastFix: Fix | null = null;
  /** Along-step progress of the last fix (for remaining distance / path). */
  private alongM = 0;
  private offSince: number | null = null;
  private offEmitted = false;
  private rerouteAsked = false;
  private lastRerouteAt = -Infinity;
  private reroutes = 0;
  private offRoutes = 0;
  private approachDone = new Set<number>();
  private alightDone = new Set<number>();

  constructor(
    steps: NavStep[],
    private readonly destination: LatLng,
  ) {
    this.steps = steps;
  }

  get status(): NavStatus {
    return this.status_;
  }
  get index(): number {
    return this.idx;
  }
  get current(): NavStep | undefined {
    return this.steps[this.idx];
  }
  get allSteps(): readonly NavStep[] {
    return this.steps;
  }
  /** Reroutes applied (`replaceSteps`). */
  get rerouteCount(): number {
    return this.reroutes;
  }
  get offRouteCount(): number {
    return this.offRoutes;
  }
  get history(): readonly StepRecord[] {
    return this.records;
  }
  /** Boarding detected on the current ride step. */
  get boarded(): boolean {
    return this.records[this.records.length - 1]?.boardedAt !== undefined;
  }

  start(t: number): NavEvent[] {
    if (this.status_ !== 'idle') return [];
    this.status_ = 'navigating';
    return this.enter(0, t);
  }

  /** Ends the trip (user ended, or the screen closed). */
  end(t: number): void {
    if (this.status_ !== 'navigating') return;
    this.closeCurrent(t);
    this.status_ = 'ended';
  }

  update(fix: Fix): NavEvent[] {
    if (this.status_ !== 'navigating') return [];
    const prev = this.lastFix;
    this.lastFix = fix;
    const at: LatLng = { latitude: fix.lat, longitude: fix.lng };
    const events: NavEvent[] = [];

    if (distanceM(at, this.destination) <= navConfig.arriveM) {
      this.closeCurrent(fix.t);
      this.status_ = 'arrived';
      return [{ type: 'arrived', t: fix.t }];
    }

    const speedKmh = speedOf(fix, prev) * KMH;
    // Advance through every step already done (short Google steps can be < 20 m).
    for (let guard = 0; guard < this.steps.length; guard++) {
      const step = this.steps[this.idx];
      if (!step) break;
      if (!this.stepDone(step, at, fix, speedKmh)) break;
      if (this.idx >= this.steps.length - 1) break; // the last step ends on arrival only
      events.push(...this.enter(this.idx + 1, fix.t));
    }

    const step = this.steps[this.idx];
    if (!step) return events;
    const proj = project(step.polyline, at);
    this.alongM = proj?.alongM ?? 0;

    if (step.kind === 'transit') {
      this.offSince = null;
      events.push(...this.rideEvents(step, at, fix, speedKmh, proj?.offsetM ?? null));
      return events;
    }

    // ~100 m before a turn (the next step isn't a ride: boarding has its own prompt).
    const next = this.steps[this.idx + 1];
    if (
      next &&
      next.kind !== 'transit' &&
      step.distanceM >= navConfig.approachMinStepM &&
      !this.approachDone.has(this.idx) &&
      distanceM(at, step.endPoint) <= navConfig.approachTurnM
    ) {
      this.approachDone.add(this.idx);
      events.push({ type: 'approachTurn', index: this.idx, next, t: fix.t });
    }

    events.push(...this.offRouteEvents(step, at, fix, proj?.offsetM ?? null));
    return events;
  }

  /**
   * Swaps in a rerouted step list (from the current position). The step in
   * progress is closed as interrupted.
   */
  replaceSteps(steps: NavStep[], t: number): NavEvent[] {
    if (this.status_ !== 'navigating' || steps.length === 0) return [];
    this.closeCurrent(t, true);
    this.steps = steps;
    this.version += 1;
    this.reroutes += 1;
    this.approachDone = new Set();
    this.alightDone = new Set();
    this.offSince = null;
    this.offEmitted = false;
    this.rerouteAsked = false;
    return this.enter(0, t, false);
  }

  /** The reroute couldn't be computed: ask again (still at most once per 30 s). */
  rerouteFailed(): void {
    this.rerouteAsked = false;
  }

  /** Path still to travel on the current step, then the later steps. */
  remainingPolyline(): LatLng[][] {
    const step = this.steps[this.idx];
    if (!step) return [];
    return [
      remainingPath(step.polyline, this.alongM),
      ...this.steps.slice(this.idx + 1).map((s) => s.polyline),
    ];
  }

  /** Metres and arrival time (ms) from fix time `t`, waiting for scheduled departures. */
  remaining(t: number): { distanceM: number; arrivalAt: number } {
    const step = this.steps[this.idx];
    if (!step) return { distanceM: 0, arrivalAt: t };
    const stepLen = step.polyline.length > 1 ? pathLengthM(step.polyline) : step.distanceM;
    const frac = stepLen > 0 ? Math.max(0, 1 - this.alongM / stepLen) : 1;
    let metres = step.distanceM * frac;
    let clock = t;
    const ride = (s: NavStep, part: number) => {
      const dep = s.transit?.scheduledDep ? Date.parse(s.transit.scheduledDep) : NaN;
      if (Number.isFinite(dep)) clock = Math.max(clock, dep);
      clock += s.predictedDurationS * 1000 * part;
    };
    if (step.kind === 'transit' && !this.boarded) ride(step, 1);
    else clock += step.predictedDurationS * 1000 * frac;
    for (const s of this.steps.slice(this.idx + 1)) {
      metres += s.distanceM;
      if (s.kind === 'transit') ride(s, 1);
      else clock += s.predictedDurationS * 1000;
    }
    return { distanceM: metres, arrivalAt: clock };
  }

  // ---- internals ----

  private enter(index: number, t: number, closePrev = true): NavEvent[] {
    if (closePrev) this.closeCurrent(t);
    this.idx = index;
    this.alongM = 0;
    this.offSince = null;
    this.offEmitted = false;
    this.rerouteAsked = false;
    const step = this.steps[index];
    if (!step) return [];
    this.records.push({ step, version: this.version, startedAt: t });
    return [{ type: 'stepStart', index, step, t }];
  }

  private closeCurrent(t: number, interrupted = false) {
    const rec = this.records[this.records.length - 1];
    if (rec && rec.endedAt === undefined) {
      rec.endedAt = t;
      if (interrupted) rec.interrupted = true;
    }
  }

  private advanceRadius(step: NavStep, fix: Fix): number {
    if (step.kind === 'transit') return navConfig.rideAdvanceM;
    return (fix.accuracy ?? 0) > navConfig.lowAccuracyM
      ? navConfig.advanceLowAccuracyM
      : navConfig.advanceM;
  }

  private stepDone(step: NavStep, at: LatLng, fix: Fix, speedKmh: number): boolean {
    if (step.kind === 'transit') {
      // Only once on board (or clearly away from the boarding point): the
      // platform of a 1-stop ride can be within 150 m of the next station.
      const rec = this.records[this.records.length - 1];
      const start = step.polyline[0];
      const left = start ? distanceM(at, start) > navConfig.rideAdvanceM : true;
      return (
        (rec?.boardedAt !== undefined || left) &&
        distanceM(at, step.endPoint) <= navConfig.rideAdvanceM
      );
    }
    if (distanceM(at, step.endPoint) <= this.advanceRadius(step, fix)) return true;
    // Walking to a ride and already moving along its line: they boarded.
    const next = this.steps[this.idx + 1];
    if (next?.kind === 'transit' && this.isBoarding(next, at, speedKmh)) return true;
    return false;
  }

  private isBoarding(step: NavStep, at: LatLng, speedKmh: number): boolean {
    if (speedKmh <= navConfig.boardSpeedKmh) return false;
    const proj = project(step.polyline, at);
    return proj ? proj.offsetM <= navConfig.boardLineM : true;
  }

  private rideEvents(
    step: NavStep,
    at: LatLng,
    fix: Fix,
    speedKmh: number,
    offsetM: number | null,
  ): NavEvent[] {
    const events: NavEvent[] = [];
    const rec = this.records[this.records.length - 1];
    if (rec && rec.boardedAt === undefined && this.isBoarding(step, at, speedKmh)) {
      rec.boardedAt = fix.t;
      events.push({ type: 'boarded', index: this.idx, t: fix.t });
    }
    if (this.alightDone.has(this.idx)) return events;
    const start = step.polyline[0];
    const moving =
      rec?.boardedAt !== undefined || (start ? distanceM(at, start) > 300 : offsetM !== null);
    if (!moving) return events;
    const stops = step.transit?.stopsLatLng;
    let soon: boolean;
    if (stops && stops.length >= 2) {
      const before = stops[stops.length - 2]!;
      const here = project(stops, at);
      const beforeAt = project(stops, before);
      soon = !!here && !!beforeAt && here.alongM >= beforeAt.alongM - navConfig.alightStopSlackM;
    } else {
      soon = distanceM(at, step.endPoint) <= navConfig.alightNoStopsM;
    }
    if (soon) {
      this.alightDone.add(this.idx);
      events.push({
        type: 'alightSoon',
        index: this.idx,
        stop: step.transit?.alightStop ?? 'your stop',
        t: fix.t,
      });
    }
    return events;
  }

  private offRouteEvents(step: NavStep, at: LatLng, fix: Fix, offsetM: number | null): NavEvent[] {
    if (offsetM === null) return []; // no geometry to compare against
    if ((fix.accuracy ?? 0) > navConfig.offRouteMaxAccuracyM) return [];
    const limit = navConfig.offRouteM[step.kind as keyof typeof navConfig.offRouteM];
    const next = this.steps[this.idx + 1];
    const nearBoarding =
      next?.kind === 'transit' &&
      !!next.polyline[0] &&
      distanceM(at, next.polyline[0]) <= navConfig.nearBoardingM;
    if (offsetM <= limit || nearBoarding) {
      this.offSince = null;
      this.offEmitted = false;
      this.rerouteAsked = false;
      return [];
    }
    this.offSince ??= fix.t;
    if (fix.t - this.offSince < navConfig.offRouteForMs) return [];
    const events: NavEvent[] = [];
    if (!this.offEmitted) {
      this.offEmitted = true;
      this.offRoutes += 1;
      events.push({ type: 'offRoute', index: this.idx, distanceM: offsetM, t: fix.t });
    }
    // Still off route after a rate-limited attempt: ask again once allowed.
    if (!this.rerouteAsked && fix.t - this.lastRerouteAt >= navConfig.rerouteEveryMs) {
      this.rerouteAsked = true;
      this.lastRerouteAt = fix.t;
      events.push({ type: 'reroute', from: at, t: fix.t });
    }
    return events;
  }
}

/** Reported speed, else from the previous fix (iOS reports -1 when unknown). */
function speedOf(fix: Fix, prev: Fix | null): number {
  if (fix.speed !== null && fix.speed >= 0) return fix.speed;
  if (!prev) return 0;
  const dt = (fix.t - prev.t) / 1000;
  if (dt <= 0 || dt > 30) return 0;
  return (
    distanceM(
      { latitude: prev.lat, longitude: prev.lng },
      { latitude: fix.lat, longitude: fix.lng },
    ) / dt
  );
}
