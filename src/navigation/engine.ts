/**
 * Turn-by-turn state machine. Pure TypeScript (no React / Expo): feed it GPS
 * fixes, act on the events it returns. Times are the fixes' own clocks (ms),
 * so tests can replay a trip.
 *
 * - Advance when within 20 m of the step's end (35 m when accuracy > 25 m),
 *   40 m at the end of a walk leg.
 * - Rides end once the user has been within 150 m of the alighting stop and
 *   is moving away from it again (alighted, or going on past it); the alight
 *   time is the closest approach.
 * - Off route: > 60 m (walk) / 100 m (own car or bike) from the step for 20 s
 *   in a row. Never during rides (GPS in vehicles is noisy) or hired autos /
 *   cabs (the driver picks the way). Fixes less accurate than 50 m are ignored.
 * - Reroute: only when the user asks (`requestReroute`), at most once per 30 s
 *   and 5 times per trip.
 * - Ride boarding: moving > 15 km/h near the line. "Get off soon" within
 *   600 m (bus) / 900 m (metro, train) of the stop; "your stop is next"
 *   within 250 m.
 * - "Next leg": the user can skip to the next leg by hand (no GPS, missed fix).
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
  /** End of a walk leg (the last of its steps). */
  legEndM: 40,
  /** A ride ends after coming this close to the alighting stop… */
  rideAdvanceM: 150,
  /** …and then moving this much further away again. */
  alightAwayM: 30,
  offRouteM: { walk: 60, drive: 100, two_wheeler: 100 },
  offRouteForMs: 20_000,
  /** Fixes worse than this neither start nor clear an off-route episode. */
  offRouteMaxAccuracyM: 50,
  /** Near the next ride's boarding point, a walk never goes off route (station forecourts). */
  nearBoardingM: 100,
  /**
   * Nor near the ride it follows: timetable station coordinates can be a few hundred
   * metres from where Google's walk out of the station starts.
   */
  nearAlightingM: 300,
  boardSpeedKmh: 15,
  /** Timetable lines are straight station-to-station segments: be generous. */
  boardLineM: 250,
  /** "Get off soon", metres before the alighting stop along the line. */
  alightSoonM: { bus: 600, metro: 900, train: 900 },
  /** "Your stop is next". */
  stopNextM: 250,
  approachTurnM: 100,
  /** Steps shorter than this get no "in 100 m" warning (it would come at once). */
  approachMinStepM: 150,
  arriveM: 50,
  rerouteEveryMs: 30_000,
  /** Route computations per trip (each costs Google calls), failed ones included. */
  maxReroutesPerTrip: 5,
} as const;

export type NavEvent =
  | { type: 'stepStart'; index: number; step: NavStep; t: number }
  /** ~100 m before the end of a walk / road step: `next` is the turn coming up. */
  | { type: 'approachTurn'; index: number; next: NavStep; t: number }
  | { type: 'boarded'; index: number; t: number }
  | { type: 'alightSoon'; index: number; stop: string; t: number }
  | { type: 'stopNext'; index: number; stop: string; t: number }
  /** Ask the user whether to reroute (`canReroute`, then `requestReroute`). */
  | { type: 'offRoute'; index: number; distanceM: number; t: number }
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
  /** Rides ended by GPS: the closest approach to the alighting stop. */
  alightedAt?: number;
  /** Ended by a reroute rather than reaching its end. */
  interrupted?: boolean;
  /** Ended with "Next leg" (by hand), not by GPS. */
  manual?: boolean;
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
  private lastRerouteAt = -Infinity;
  /** Current ride: closest approach to its alighting stop (metres, fix time). */
  private nearest: { m: number; t: number } | null = null;
  private reroutes = 0;
  private rerouteRequests = 0;
  private offRoutes = 0;
  private approachDone = new Set<number>();
  private alightDone = new Set<number>();
  private stopNextDone = new Set<number>();

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
  /** 5 reroutes asked for: off-route is still reported, but no new route is computed. */
  get rerouteLimitReached(): boolean {
    return this.rerouteRequests >= navConfig.maxReroutesPerTrip;
  }
  /** Off route right now (until back within the limit, or the step changes). */
  get offRoute(): boolean {
    return this.offEmitted;
  }
  /** The leg after the current one exists ("Next leg" can be offered). */
  get hasNextLeg(): boolean {
    const leg = this.steps[this.idx]?.legIndex;
    return this.steps.some((s, i) => i > this.idx && s.legIndex !== leg);
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
      // Arrived from the vehicle itself (the destination is by the line): it's the alight time too.
      const rec = this.records[this.records.length - 1];
      if (rec && rec.step.kind === 'transit' && rec.endedAt === undefined) rec.alightedAt = fix.t;
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
      if (step.kind === 'transit' && this.nearest) {
        // Got off at the closest approach, not when they had walked away.
        const rec = this.records[this.records.length - 1];
        if (rec) rec.alightedAt = this.nearest.t;
        this.closeCurrent(this.nearest.t);
      }
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
    this.stopNextDone = new Set();
    return this.enter(0, t, false);
  }

  /** A reroute may be computed now: under the per-trip cap, 30 s after the last one. */
  canReroute(t: number): boolean {
    return (
      this.status_ === 'navigating' &&
      !this.rerouteLimitReached &&
      t - this.lastRerouteAt >= navConfig.rerouteEveryMs
    );
  }

  /**
   * The user asked to reroute: the position to compute the new route from
   * (then `replaceSteps`), or null when not allowed now / no fix yet.
   */
  requestReroute(t: number): LatLng | null {
    if (!this.lastFix || !this.canReroute(t)) return null;
    this.rerouteRequests += 1;
    this.lastRerouteAt = t;
    return { latitude: this.lastFix.lat, longitude: this.lastFix.lng };
  }

  /** "Next leg" by hand: the current leg ends now, the next leg's first step starts. */
  skipLeg(t: number): NavEvent[] {
    if (this.status_ !== 'navigating') return [];
    const leg = this.steps[this.idx]?.legIndex;
    const next = this.steps.findIndex((s, i) => i > this.idx && s.legIndex !== leg);
    if (next < 0) return [];
    const rec = this.records[this.records.length - 1];
    if (rec && rec.endedAt === undefined) rec.manual = true;
    return this.enter(next, t);
  }

  /** Metres and seconds to the end of the current leg (its remaining steps). */
  legRemaining(): { distanceM: number; durationS: number } {
    const step = this.steps[this.idx];
    if (!step) return { distanceM: 0, durationS: 0 };
    const stepLen = step.polyline.length > 1 ? pathLengthM(step.polyline) : step.distanceM;
    const frac = stepLen > 0 ? Math.max(0, 1 - this.alongM / stepLen) : 1;
    let distance = step.distanceM * frac;
    let duration = step.predictedDurationS * frac;
    for (const s of this.steps.slice(this.idx + 1)) {
      if (s.legIndex !== step.legIndex) break;
      distance += s.distanceM;
      duration += s.predictedDurationS;
    }
    return { distanceM: distance, durationS: duration };
  }

  /** Along-line progress on the current step (metres). */
  get progressM(): number {
    return this.alongM;
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
    this.nearest = null;
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
    const radius =
      (fix.accuracy ?? 0) > navConfig.lowAccuracyM
        ? navConfig.advanceLowAccuracyM
        : navConfig.advanceM;
    const next = this.steps[this.idx + 1];
    const legEnd = step.kind === 'walk' && (!next || next.legIndex !== step.legIndex);
    return legEnd ? Math.max(radius, navConfig.legEndM) : radius;
  }

  private stepDone(step: NavStep, at: LatLng, fix: Fix, speedKmh: number): boolean {
    if (step.kind === 'transit') {
      // Only once on board (or clearly away from the boarding point): the
      // platform of a 1-stop ride can be within 150 m of the next station.
      const rec = this.records[this.records.length - 1];
      const start = step.polyline[0];
      const left = start ? distanceM(at, start) > navConfig.rideAdvanceM : true;
      if (rec?.boardedAt === undefined && !left) return false;
      // Near the alighting stop, then moving away from it: got off (or rode past).
      const toEnd = distanceM(at, step.endPoint);
      if (toEnd <= navConfig.rideAdvanceM && (!this.nearest || toEnd < this.nearest.m)) {
        this.nearest = { m: toEnd, t: fix.t };
      }
      return !!this.nearest && toEnd >= this.nearest.m + navConfig.alightAwayM;
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
    if (this.alightDone.has(this.idx) && this.stopNextDone.has(this.idx)) return events;
    const start = step.polyline[0];
    const moving =
      rec?.boardedAt !== undefined || (start ? distanceM(at, start) > 300 : offsetM !== null);
    if (!moving) return events;
    const stop = step.transit?.alightStop ?? 'your stop';
    const toStop = rideRemainingM(step, at);
    const mode = step.transit?.mode ?? 'bus';
    if (!this.alightDone.has(this.idx) && toStop <= navConfig.alightSoonM[mode]) {
      this.alightDone.add(this.idx);
      events.push({ type: 'alightSoon', index: this.idx, stop, t: fix.t });
    }
    if (!this.stopNextDone.has(this.idx) && toStop <= navConfig.stopNextM) {
      this.stopNextDone.add(this.idx);
      events.push({ type: 'stopNext', index: this.idx, stop, t: fix.t });
    }
    return events;
  }

  private offRouteEvents(step: NavStep, at: LatLng, fix: Fix, offsetM: number | null): NavEvent[] {
    if (offsetM === null) return []; // no geometry to compare against
    if (step.kind !== 'walk' && !step.ownVehicle) return []; // a hired auto / cab
    if ((fix.accuracy ?? 0) > navConfig.offRouteMaxAccuracyM) return [];
    const limit = navConfig.offRouteM[step.kind as keyof typeof navConfig.offRouteM];
    const next = this.steps[this.idx + 1];
    const nearBoarding =
      next?.kind === 'transit' &&
      !!next.polyline[0] &&
      distanceM(at, next.polyline[0]) <= navConfig.nearBoardingM;
    const prev = this.steps[this.idx - 1];
    const nearAlighting =
      prev?.kind === 'transit' && distanceM(at, prev.endPoint) <= navConfig.nearAlightingM;
    if (offsetM <= limit || nearBoarding || nearAlighting) {
      this.offSince = null;
      this.offEmitted = false;
      return [];
    }
    this.offSince ??= fix.t;
    if (fix.t - this.offSince < navConfig.offRouteForMs || this.offEmitted) return [];
    this.offEmitted = true;
    this.offRoutes += 1;
    return [{ type: 'offRoute', index: this.idx, distanceM: offsetM, t: fix.t }];
  }
}

/** Metres to a ride's alighting stop: along the line when on it, else straight. */
function rideRemainingM(step: NavStep, at: LatLng): number {
  const straight = distanceM(at, step.endPoint);
  const proj = project(step.polyline, at);
  if (!proj || proj.offsetM > navConfig.boardLineM) return straight;
  return Math.max(straight, proj.totalM - proj.alongM);
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
