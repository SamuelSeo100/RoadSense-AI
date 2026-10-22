import { autoFare, cabFare, fuelCost, transitLegFare, transitRouteFare } from '../fares';
import { LruCache } from '../lruCache';
import { rankRoutes } from '../ranking';
import { bestIndex, scoreRoutes, trafficLevel, type SpeedReading } from '../scoring';
import {
  applyMetroTable,
  dropDominated,
  mergeNearDuplicates,
  timetableDrafts,
  type AccessLeg,
  type FetchAccess,
} from '../transit/injection';
import { metroInService } from '../transit/metro';
import { istMinutes } from '../transit/time';
import {
  PRIORITIES,
  type DirectionsService,
  type LatLng,
  type Leg,
  type LegStep,
  type Place,
  type PreferencesService,
  type Priority,
  type RankedRoute,
  type Route,
  type RouteDataSource,
  type RouteNotice,
  type RouteSource,
  type RoutingService,
  type TrafficLevel,
  type Vehicle,
  type WalkingRoute,
} from '../types';

import { isNight } from '../walkSafety';

import { googleCallCount, googleRequest } from './googleClient';
import { legSteps, stepPath, type GoogleNavStep } from './googleDirectionsService';
import { decodePolyline } from './polyline';

/** Tunables for building route options (fares live in fares.ts, weights in scoring.ts). */
export const routingConfig = {
  /** Kept per priority: a route stays if it's in the top 8 for any priority (local re-ranking). */
  maxResults: 8,
  /** The walk-only option is shown only up to this long. */
  maxWalkOnlyMin: 30,
  /**
   * Transit options whose first vehicle leaves later than this after you could
   * reach the stop are dropped (late at night Google returns tomorrow's first bus).
   */
  maxTransitWaitMin: 45,
  /**
   * Local trains run up to ~1 h apart: the next one is still shown up to this
   * far ahead, its wait in the total time (the ranker penalises it) and on the card.
   */
  maxTrainWaitMin: 120,
  /** A first/last walk longer than this also gets an "Auto to/from <stop>" variant. */
  firstLastMileKm: 1.2,
  /** Straight-line → road distance, for estimated auto legs. */
  roadFactor: 1.3,
  autoSpeedKmh: 20,
  autoPickupMin: 3,
  walkSpeedKmh: 4.8,
  /** Bus legs this short are walked instead (Google suggests 1-stop hops). */
  shortHop: { maxStops: 1, maxMeters: 800 },
  /** Near-duplicates: same legs and duration within this bucket. */
  dedupeBucketMin: 2,
  cacheBucketMin: 10,
} as const;

const COMPUTE_ROUTES = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const TRANSIT_MASK = [
  'routes.duration',
  'routes.travelAdvisory.transitFare',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.navigationInstruction',
  'routes.legs.steps.polyline.encodedPolyline',
  'routes.legs.steps.startLocation.latLng',
  'routes.legs.steps.endLocation.latLng',
  'routes.legs.steps.transitDetails.stopDetails',
  'routes.legs.steps.transitDetails.headsign',
  'routes.legs.steps.transitDetails.stopCount',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
  'routes.legs.steps.transitDetails.transitLine.vehicle.type',
].join(',');
// The overview polyline is kept only for traffic (speed intervals index into it);
// the drawn path comes from the step polylines.
const ROAD_MASK =
  'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals';
/** Auto to / from a timetable station: time, distance and street geometry only. */
const ACCESS_MASK =
  'routes.duration,routes.distanceMeters,routes.legs.steps.polyline.encodedPolyline';

// ---- Routes API response shapes (only the masked fields) ----

interface GStep extends GoogleNavStep {
  travelMode?: string;
  startLocation?: { latLng?: LatLng };
  endLocation?: { latLng?: LatLng };
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string; location?: { latLng?: LatLng } };
      arrivalStop?: { name?: string; location?: { latLng?: LatLng } };
      departureTime?: string;
      arrivalTime?: string;
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: { name?: string; nameShort?: string; vehicle?: { type?: string } };
  };
}

interface TransitResponse {
  routes?: {
    duration?: string;
    travelAdvisory?: { transitFare?: { currencyCode?: string; units?: string; nanos?: number } };
    legs?: { steps?: GStep[] }[];
  }[];
}

interface RoadResponse {
  routes?: {
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
    legs?: { steps?: GoogleNavStep[] }[];
    travelAdvisory?: {
      speedReadingIntervals?: {
        startPolylinePointIndex?: number;
        endPolylinePointIndex?: number;
        speed?: SpeedReading;
      }[];
    };
  }[];
}

// ---- Internal draft of a transit option (Google's or from our timetables) ----

type TransitMode = 'metro' | 'train' | 'bus';

export interface DraftLeg {
  mode: 'walk' | 'auto' | TransitMode;
  durationSec: number;
  distanceM: number;
  path: LatLng[];
  approximate: boolean;
  /** Transit legs: final label ("Metro Aqua Line"), also part of the dedupe signature. */
  label?: string;
  stops?: number;
  fromStop?: string;
  toStop?: string;
  /** Fare from our tables (src/services/transit); undefined = fares.ts slabs. */
  fareInr?: number;
  fareEstimated?: boolean;
  /** False: timed from a static timetable. */
  realtime?: false;
  lineColor?: string;
  /** "08:14" IST, timetable legs. */
  departure?: string;
  /** Minutes waited at the platform before this (first) ride, timetable options. */
  waitMin?: number;
  /** ISO departure (Google's stopDetails, or the timetable time on the trip date). */
  departureAt?: string;
  /** Google transit legs: scheduled arrival, stop coordinates and the line's short name (bus ETA). */
  arrivalAt?: string;
  fromLocation?: LatLng;
  toLocation?: LatLng;
  lineShortName?: string;
  headsign?: string;
  /** Walk / road legs: Google's turn-by-turn steps. */
  steps?: LegStep[];
}

export interface Draft {
  legs: DraftLeg[];
  /** Door to door from now, including the wait for the first vehicle. */
  durationSec: number;
  /** Google's duration (no initial wait): later departures of one route share it. */
  rideSec: number;
  googleFareInr: number | null;
  /** False once a transit leg was replaced (Google's fare no longer applies). */
  transitUnchanged: boolean;
  source: RouteDataSource;
}

type ScoredRoute = Omit<Route, 'aiPick'>;
interface Candidates {
  routes: ScoredRoute[];
  notices: RouteNotice[];
}

// ---- Helpers ----

const seconds = (d?: string) => Number.parseInt(d ?? '0', 10) || 0;
const minutes = (sec: number) => Math.max(1, Math.round(sec / 60));
const decode = (encoded?: string) => (encoded ? decodePolyline(encoded) : []);
const isTransit = (l: { mode: string }): l is DraftLeg & { mode: TransitMode } =>
  l.mode === 'metro' || l.mode === 'train' || l.mode === 'bus';
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const segmentsKm = (path: LatLng[]) => path.slice(1).map((p, i) => haversineKm(path[i] ?? p, p));

const keyOf = (p: LatLng) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
const waypoint = (p: LatLng) => ({ location: { latLng: p } });
const toLatLng = (p: Place | LatLng): LatLng => ('location' in p ? p.location : p);

function transitModeOf(vehicleType?: string): TransitMode {
  switch (vehicleType) {
    case 'SUBWAY':
    case 'METRO_RAIL':
    case 'LIGHT_RAIL':
    case 'MONORAIL':
    case 'TRAM':
      return 'metro';
    case 'RAIL':
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN':
    case 'HIGH_SPEED_TRAIN':
    case 'LONG_DISTANCE_TRAIN':
      return 'train';
    default:
      return 'bus';
  }
}

/** "Metro Aqua Line", "Bus 208B", "Bus · Swargate". Never the agency name. */
function transitLabel(mode: TransitMode, details: GStep['transitDetails']): string {
  const line = details?.transitLine;
  if (mode === 'bus') {
    if (line?.nameShort) return `Bus ${line.nameShort}`;
    return details?.headsign ? `Bus · ${details.headsign}` : 'Bus';
  }
  const name = line?.nameShort ?? line?.name;
  const prefix = mode === 'metro' ? 'Metro' : 'Train';
  return name ? `${prefix} ${name}` : prefix;
}

/** Consecutive walk legs become one (Google splits walks into many steps). */
function mergeWalks(legs: DraftLeg[]): DraftLeg[] {
  const out: DraftLeg[] = [];
  for (const leg of legs) {
    const prev = out[out.length - 1];
    if (prev && prev.mode === 'walk' && leg.mode === 'walk') {
      out[out.length - 1] = {
        ...prev,
        durationSec: prev.durationSec + leg.durationSec,
        distanceM: prev.distanceM + leg.distanceM,
        path: [...prev.path, ...leg.path],
        approximate: prev.approximate || leg.approximate,
        steps: [...(prev.steps ?? []), ...(leg.steps ?? [])],
      };
    } else {
      out.push(leg);
    }
  }
  return out.filter((l) => l.mode !== 'walk' || l.distanceM > 0);
}

/**
 * Transit options with door-to-door durations measured from `at` (Google's
 * `duration` leaves out the wait for the first vehicle).
 */
function parseTransit(res: TransitResponse, at: Date): Draft[] {
  return (res.routes ?? []).flatMap((r) => {
    const steps = (r.legs ?? []).flatMap((l) => l.steps ?? []);
    const legs = steps.map((step): DraftLeg => {
      const details = step.transitDetails;
      if (step.travelMode !== 'TRANSIT' || !details) {
        return {
          mode: 'walk',
          durationSec: seconds(step.staticDuration),
          distanceM: step.distanceMeters ?? 0,
          path: decode(step.polyline?.encodedPolyline),
          approximate: false,
          steps: legSteps([step]),
        };
      }
      const mode = transitModeOf(details.transitLine?.vehicle?.type);
      const dep = Date.parse(details.stopDetails?.departureTime ?? '');
      const arr = Date.parse(details.stopDetails?.arrivalTime ?? '');
      return {
        mode,
        durationSec:
          Number.isFinite(dep) && Number.isFinite(arr) && arr > dep
            ? (arr - dep) / 1000
            : seconds(step.staticDuration),
        distanceM: step.distanceMeters ?? 0,
        path: decode(step.polyline?.encodedPolyline),
        approximate: false,
        label: transitLabel(mode, details),
        stops: details.stopCount,
        fromStop: details.stopDetails?.departureStop?.name,
        toStop: details.stopDetails?.arrivalStop?.name,
        headsign: details.headsign,
        departureAt: Number.isFinite(dep) ? new Date(dep).toISOString() : undefined,
        arrivalAt: Number.isFinite(arr) ? new Date(arr).toISOString() : undefined,
        fromLocation: details.stopDetails?.departureStop?.location?.latLng,
        toLocation: details.stopDetails?.arrivalStop?.location?.latLng,
        lineShortName: details.transitLine?.nameShort,
      };
    });
    if (!legs.some(isTransit)) return [];

    const times = steps.flatMap((s) => (s.transitDetails ? [s.transitDetails.stopDetails] : []));
    const firstDep = Date.parse(times[0]?.departureTime ?? '');
    const lastArr = Date.parse(times[times.length - 1]?.arrivalTime ?? '');
    const firstTransit = legs.findIndex(isTransit);
    const lastTransit = legs.length - 1 - [...legs].reverse().findIndex(isTransit);
    const walkSec = (from: number, to: number) =>
      legs.slice(from, to).reduce((sum, l) => sum + l.durationSec, 0);
    let durationSec = seconds(r.duration);
    if (Number.isFinite(firstDep) && Number.isFinite(lastArr)) {
      const waitSec = (firstDep - at.getTime()) / 1000 - walkSec(0, firstTransit);
      const maxWaitMin =
        legs[firstTransit]?.mode === 'train'
          ? routingConfig.maxTrainWaitMin
          : routingConfig.maxTransitWaitMin;
      if (waitSec > maxWaitMin * 60) return [];
      durationSec = Math.max(
        durationSec,
        (lastArr - at.getTime()) / 1000 + walkSec(lastTransit + 1, legs.length),
      );
    }

    const fare = r.travelAdvisory?.transitFare;
    const googleFareInr =
      fare?.units !== undefined && (fare.currencyCode ?? 'INR') === 'INR'
        ? Number(fare.units) + (fare.nanos ?? 0) / 1e9
        : null;
    return [
      {
        legs: mergeWalks(legs),
        durationSec,
        rideSec: seconds(r.duration),
        googleFareInr: Number.isFinite(googleFareInr) ? googleFareInr : null,
        transitUnchanged: true,
        source: 'google' as const,
      },
    ];
  });
}

/** Bus hops of ≤1 stop and <800 m are walked instead (straight-line geometry, flagged). */
function walkShortHops(draft: Draft): Draft | null {
  const { maxStops, maxMeters } = routingConfig.shortHop;
  let changed = false;
  let durationSec = draft.durationSec;
  const legs = draft.legs.map((leg): DraftLeg => {
    if (leg.mode !== 'bus' || (leg.stops ?? Infinity) > maxStops || leg.distanceM >= maxMeters) {
      return leg;
    }
    changed = true;
    const walkSec = (leg.distanceM / 1000 / routingConfig.walkSpeedKmh) * 3600;
    // The next vehicle is the same either way; only a walk slower than the hop adds time.
    durationSec += Math.max(0, walkSec - leg.durationSec);
    const first = leg.path[0];
    const last = leg.path[leg.path.length - 1];
    return {
      mode: 'walk',
      durationSec: walkSec,
      distanceM: leg.distanceM,
      path: first && last ? [first, last] : [],
      approximate: true,
    };
  });
  if (!changed) return draft;
  const merged = mergeWalks(legs);
  if (!merged.some(isTransit)) return null; // Walk-only now: the walk option covers it.
  const rideSec = draft.rideSec + (durationSec - draft.durationSec);
  return { ...draft, legs: merged, durationSec, rideSec, transitUnchanged: false };
}

/** Same legs (modes + lines) and duration within a 2-min bucket. */
const signatureOf = (d: Draft) =>
  `${d.legs.map((l) => l.label ?? l.mode).join('>')}|${Math.round(d.rideSec / 60 / routingConfig.dedupeBucketMin)}`;

/** Same legs + lines and ride time within 2 min: keep the copy that arrives first. */
function dedupe(drafts: Draft[]): Draft[] {
  const best = new Map<string, Draft>();
  for (const d of drafts) {
    const sig = signatureOf(d);
    const kept = best.get(sig);
    if (!kept || d.durationSec < kept.durationSec) best.set(sig, d);
  }
  return [...best.values()];
}

function autoLegFor(walk: DraftLeg, stop: string | undefined, end: 'first' | 'last'): DraftLeg {
  const first = walk.path[0];
  const last = walk.path[walk.path.length - 1];
  const straightKm = first && last ? haversineKm(first, last) : walk.distanceM / 1000;
  const km = straightKm * routingConfig.roadFactor;
  return {
    mode: 'auto',
    durationSec: (routingConfig.autoPickupMin + (km / routingConfig.autoSpeedKmh) * 60) * 60,
    distanceM: km * 1000,
    // Roughly the same streets as the walk; flagged as an estimate.
    path: walk.path,
    approximate: true,
    label: stop ? `Auto ${end === 'first' ? 'to' : 'from'} ${stop}` : 'Auto',
  };
}

/** First/last walks over the threshold also get an auto variant (no extra API call). */
function withAutoVariants(draft: Draft): Draft[] {
  const { legs } = draft;
  const threshold = routingConfig.firstLastMileKm * 1000;
  const transit = legs.filter(isTransit);
  const head = legs[0];
  const tail = legs[legs.length - 1];
  const longHead = head?.mode === 'walk' && head.distanceM > threshold ? head : null;
  const longTail =
    tail?.mode === 'walk' && tail.distanceM > threshold && tail !== head ? tail : null;

  const variant = (replaceHead: boolean, replaceTail: boolean): Draft => {
    let durationSec = draft.durationSec;
    const next = legs.map((leg, i) => {
      const isHead = i === 0 && replaceHead;
      const isTail = i === legs.length - 1 && replaceTail;
      if (!isHead && !isTail) return leg;
      const auto = autoLegFor(
        leg,
        isHead ? transit[0]?.fromStop : transit[transit.length - 1]?.toStop,
        isHead ? 'first' : 'last',
      );
      // First mile: you still catch the same vehicle (it only adds time if slower).
      // Last mile: arrival moves by the difference.
      const delta = auto.durationSec - leg.durationSec;
      durationSec += isHead ? Math.max(0, delta) : delta;
      return auto;
    });
    return { ...draft, legs: next, durationSec };
  };

  const variants: Draft[] = [draft];
  if (longHead) variants.push(variant(true, false));
  if (longTail) variants.push(variant(false, true));
  if (longHead && longTail) variants.push(variant(true, true));
  return variants;
}

function legLabel(leg: DraftLeg): string {
  if (leg.label) return leg.label;
  return `${capitalise(leg.mode)} ${minutes(leg.durationSec)}m`;
}

const walkKmOf = (legs: { mode: string; distanceKm?: number }[]) =>
  Math.round(legs.reduce((s, l) => s + (l.mode === 'walk' ? (l.distanceKm ?? 0) : 0), 0) * 10) / 10;

function metaOf(r: Pick<Route, 'walkingKm' | 'transfers' | 'traffic'>, extra?: string): string {
  const parts = [
    `${r.walkingKm.toFixed(1)} km walk`,
    `${r.transfers} transfer${r.transfers === 1 ? '' : 's'}`,
    `${r.traffic} traffic`,
  ];
  return extra ? [...parts, extra].join(' · ') : parts.join(' · ');
}

function transitToRoute(
  id: string,
  draft: Draft,
  at: Date,
  roadTraffic: TrafficLevel,
): Omit<Route, 'score'> {
  const transitLegs = draft.legs.filter(isTransit).map((l) => ({
    mode: l.mode,
    distanceKm: l.distanceM / 1000,
    stops: l.stops,
  }));
  // Google gives a route total (bus-only routes); otherwise every leg is costed here:
  // from our timetable fare tables when set, else the fares.ts slabs.
  const googleTotal =
    draft.googleFareInr !== null &&
    draft.transitUnchanged &&
    transitLegs.every((t) => t.mode === 'bus');
  const legFare = (l: DraftLeg & { mode: TransitMode }) =>
    l.fareInr ?? transitLegFare({ mode: l.mode, distanceKm: l.distanceM / 1000, stops: l.stops });
  const transitCost = googleTotal
    ? transitRouteFare(transitLegs, draft.googleFareInr, draft.transitUnchanged)
    : draft.legs.filter(isTransit).reduce((sum, l) => sum + legFare(l), 0);

  const legs: Leg[] = draft.legs.map((l) => {
    let costInr: number | undefined;
    if (l.mode === 'auto') costInr = autoFare(l.distanceM / 1000, at);
    else if (isTransit(l) && !googleTotal) costInr = legFare(l);
    return {
      mode: l.mode,
      label: legLabel(l),
      durationMin: minutes(l.durationSec),
      costInr,
      polyline: l.path,
      approximate: l.approximate || undefined,
      distanceKm: Math.round(l.distanceM / 100) / 10,
      stops: l.stops,
      from: l.fromStop,
      to: l.toStop,
      realtime: l.realtime,
      departure: l.departure,
      departureAt: l.departureAt,
      arrivalAt: l.arrivalAt,
      fromLocation: l.fromLocation,
      toLocation: l.toLocation,
      lineShortName: l.lineShortName,
      headsign: l.headsign,
      steps: l.steps?.length ? l.steps : undefined,
      waitMin: l.waitMin,
      lineColor: l.lineColor,
      // A timetable leg with no fare from our tables fell back to the fares.ts estimate.
      fareEstimated:
        isTransit(l) && (l.fareEstimated || (l.realtime === false && l.fareInr === undefined))
          ? true
          : undefined,
    };
  });

  // "Metro + Bus", not "Bus + Bus" for a walk between two buses.
  const modes = legs
    .map((l) => l.mode)
    .filter((m) => m !== 'walk')
    .filter((m, i, all) => m !== all[i - 1]);
  const onRoad = modes.includes('bus') || modes.includes('auto');
  const base = {
    walkingKm: walkKmOf(legs),
    transfers: Math.max(0, transitLegs.length - 1),
    traffic: onRoad ? roadTraffic : ('Light' as TrafficLevel),
  };
  return {
    id,
    source: draft.source,
    name: modes.map(capitalise).join(' + '),
    mapKey: draft.legs.find(isTransit)?.mode ?? 'all',
    durationMin: minutes(draft.durationSec),
    costInr: transitCost + legs.reduce((s, l) => s + (l.mode === 'auto' ? (l.costInr ?? 0) : 0), 0),
    ...base,
    legs,
    meta: metaOf(base),
  };
}

interface RoadInfo {
  durationSec: number;
  distanceKm: number;
  path: LatLng[];
  traffic: TrafficLevel;
  steps: LegStep[];
}

function parseRoad(res: RoadResponse): RoadInfo | null {
  const r = res.routes?.[0];
  if (!r) return null;
  const overview = decode(r.polyline?.encodedPolyline);
  const path = stepPath(r);
  const intervals = (r.travelAdvisory?.speedReadingIntervals ?? []).map((i) => ({
    start: i.startPolylinePointIndex ?? 0,
    end: i.endPolylinePointIndex ?? 0,
    speed: i.speed ?? 'NORMAL',
  }));
  return {
    durationSec: seconds(r.duration),
    distanceKm: (r.distanceMeters ?? 0) / 1000,
    path,
    traffic: trafficLevel(intervals, segmentsKm(overview)),
    steps: (r.legs ?? []).flatMap((l) => legSteps(l.steps)),
  };
}

function roadRoute(
  id: string,
  kind: 'auto' | 'cab' | 'car' | 'bike',
  road: RoadInfo,
  costInr: number,
  extraMeta?: string,
): Omit<Route, 'score'> {
  const mode = kind === 'car' ? 'cab' : kind;
  const name = capitalise(kind);
  const durationMin = minutes(road.durationSec);
  const base = { walkingKm: 0, transfers: 0, traffic: road.traffic };
  return {
    id,
    source: 'google',
    name,
    mapKey: mode,
    vehicle: kind === 'car' || kind === 'bike' ? kind : undefined,
    durationMin,
    costInr,
    ...base,
    legs: [
      {
        mode,
        label: `${name} ${durationMin}m`,
        durationMin,
        costInr,
        polyline: road.path,
        distanceKm: Math.round(road.distanceKm * 10) / 10,
        steps: road.steps.length ? road.steps : undefined,
      },
    ],
    meta: metaOf(base, extraMeta),
  };
}

function walkRoute(walk: WalkingRoute): Omit<Route, 'score'> {
  const durationMin = minutes(walk.durationSec);
  const distanceKm = walk.distanceMeters / 1000;
  const base = {
    walkingKm: Math.round(distanceKm * 10) / 10,
    transfers: 0,
    traffic: 'Light' as TrafficLevel,
  };
  return {
    id: 'walk',
    source: 'google',
    name: 'Walk',
    mapKey: 'walk',
    durationMin,
    costInr: 0,
    ...base,
    legs: [
      {
        mode: 'walk',
        label: `Walk ${durationMin}m`,
        durationMin,
        costInr: 0,
        polyline: walk.path,
        distanceKm: base.walkingKm,
        steps: walk.steps?.length ? walk.steps : undefined,
      },
    ],
    meta: metaOf(base),
  };
}

/** Marks the best route for `priority` as the AI pick. TODO(ml): the learned ranker replaces this. */
function withAiPick<T extends ScoredRoute>(
  routes: T[],
  priority: Priority,
): (T & { aiPick?: boolean })[] {
  const best = bestIndex(routes, priority);
  return routes.map((r, i) => (i === best ? { ...r, aiPick: true } : r));
}

/**
 * Multimodal options from Google Routes API: TRANSIT (+ auto first/last mile),
 * DRIVE (auto, cab, own car), TWO_WHEELER (own bike) and the safe-walk route.
 * Fares are estimated in fares.ts, scores in scoring.ts.
 */
export function createGoogleRoutingService(deps: {
  directions: DirectionsService;
  preferences: PreferencesService;
  /** Place search / geocoding stay on their existing implementation. */
  places: Pick<RoutingService, 'searchPlaces' | 'geocode'>;
}): RoutingService {
  const cache = new LruCache<string, Candidates>(20);
  /** Point ↔ station legs for timetable options, kept for the session. */
  const accessCache = new LruCache<string, AccessLeg>(60);

  const computeRoutes = <T>(body: object, fieldMask: string, signal?: AbortSignal) =>
    googleRequest<T>(COMPUTE_ROUTES, {
      signal,
      fieldMask,
      body: { languageCode: 'en-IN', units: 'METRIC', ...body },
    });

  /** Walk (safe-walk service) or auto (DRIVE time + pickup) between a point and a station. */
  const accessFetcher =
    (at: Date, signal?: AbortSignal): FetchAccess =>
    async (a, b, mode) => {
      const key = `${mode}|${keyOf(a)}>${keyOf(b)}${mode === 'walk' && isNight(at) ? '|night' : ''}`;
      const cached = accessCache.get(key);
      if (cached) return cached;
      let leg: AccessLeg | null = null;
      if (mode === 'walk') {
        const w = await deps.directions.walking(a, b, { signal, at });
        leg = {
          mode,
          durationSec: w.durationSec,
          distanceM: w.distanceMeters,
          path: w.path,
          approximate: false,
          steps: w.steps,
        };
      } else {
        const res = await computeRoutes<RoadResponse>(
          {
            origin: waypoint(a),
            destination: waypoint(b),
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
            polylineQuality: 'HIGH_QUALITY',
          },
          ACCESS_MASK,
          signal,
        );
        const road = parseRoad(res);
        if (road)
          leg = {
            mode,
            durationSec: road.durationSec + routingConfig.autoPickupMin * 60,
            distanceM: road.distanceKm * 1000,
            path: road.path,
            approximate: false,
          };
      }
      if (leg) accessCache.set(key, leg);
      return leg;
    };

  async function candidates(
    fromP: Place | LatLng,
    toP: Place,
    vehicles: Record<Vehicle, boolean>,
    signal?: AbortSignal,
    departAt?: Date,
  ): Promise<Candidates & { googleAt: number | null }> {
    const from = toLatLng(fromP);
    const to = toP.location;
    // A requested departure ("at 6 pm"); past times mean now.
    const at = departAt && departAt.getTime() > Date.now() ? departAt : new Date();
    const bucket = Math.floor(at.getTime() / (routingConfig.cacheBucketMin * 60_000));
    const key = `${keyOf(from)}>${keyOf(to)}|${bucket}|b${vehicles.bike ? 1 : 0}c${vehicles.car ? 1 : 0}`;
    const cached = cache.get(key);
    if (cached) return { ...cached, googleAt: null };

    const ends = { origin: waypoint(from), destination: waypoint(to) };
    const road = (travelMode: 'DRIVE' | 'TWO_WHEELER') =>
      computeRoutes<RoadResponse>(
        {
          ...ends,
          travelMode,
          routingPreference: 'TRAFFIC_AWARE',
          extraComputations: ['TRAFFIC_ON_POLYLINE'],
          // Follows the streets when zoomed in (overview quality cuts corners).
          polylineQuality: 'HIGH_QUALITY',
          // Predicted traffic for a later departure (the API rejects past times).
          ...(at.getTime() > Date.now() + 60_000 ? { departureTime: at.toISOString() } : {}),
        },
        ROAD_MASK,
        signal,
      );

    const callsBefore = googleCallCount();
    const [transitRes, driveRes, bikeRes, walkRes, timetableRes] = await Promise.allSettled([
      computeRoutes<TransitResponse>(
        {
          ...ends,
          travelMode: 'TRANSIT',
          computeAlternativeRoutes: true,
          // Step polylines (walks included) follow the streets instead of cutting blocks.
          polylineQuality: 'HIGH_QUALITY',
          departureTime: at.toISOString(),
        },
        TRANSIT_MASK,
        signal,
      ),
      road('DRIVE'),
      vehicles.bike ? road('TWO_WHEELER') : Promise.resolve(null),
      deps.directions.walking(from, to, { signal, at }),
      // Metro / local train from our timetables, alongside Google's calls.
      (async () => {
        const before = googleCallCount();
        const drafts = await timetableDrafts({
          from,
          to,
          at,
          fetchAccess: accessFetcher(at, signal),
          maxWaitMin: routingConfig.maxTransitWaitMin,
          maxTrainWaitMin: routingConfig.maxTrainWaitMin,
        });
        return { drafts, calls: googleCallCount() - before };
      })(),
    ]);
    // Every Google response (and the timetable access legs) is in: merge + rank from here.
    const googleAt = Date.now();
    if (signal?.aborted) throw new Error('Route request aborted.');

    const attempted = [transitRes, driveRes, walkRes, ...(vehicles.bike ? [bikeRes] : [])];
    const failures = attempted.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
    if (failures.length === attempted.length) {
      throw failures[0] instanceof Error ? failures[0] : new Error('Couldn’t get routes.');
    }

    const drive = driveRes.status === 'fulfilled' ? parseRoad(driveRes.value) : null;
    const bike = bikeRes.status === 'fulfilled' && bikeRes.value ? parseRoad(bikeRes.value) : null;
    const routes: Omit<Route, 'score'>[] = [];

    const drafts = transitRes.status === 'fulfilled' ? parseTransit(transitRes.value, at) : [];
    const timetable = timetableRes.status === 'fulfilled' ? timetableRes.value : null;
    // Same stations and modes from both sources: only the faster copy stays.
    const merged = mergeNearDuplicates(
      dedupe(drafts.flatMap((d) => walkShortHops(d) ?? []))
        .flatMap(withAutoVariants)
        // Google's timing, our metro fare table and line colours.
        .map((d) => applyMetroTable(d)),
      timetable?.drafts ?? [],
    );
    const googleDrafts = merged.google;
    const injected = dropDominated(
      merged.timetable.map((d, i) =>
        transitToRoute(`timetable-${i}`, d, at, drive?.traffic ?? 'Light'),
      ),
    );
    if (__DEV__) {
      // Bounded: base 3–4 calls + at most 2 access + 2 egress per timetable system.
      console.info(
        `[routing] Google calls: ${googleCallCount() - callsBefore} (timetable access/egress: ${timetable?.calls ?? 0}); timetable options: ${injected.length}`,
      );
    }
    if (timetableRes.status === 'rejected' && __DEV__) {
      console.warn('[routing] timetable options failed', timetableRes.reason);
    }
    const notices: RouteNotice[] = [];
    const failed = (
      [
        ['transit', transitRes],
        ['road', driveRes],
        ['bike', bikeRes],
        ['walk', walkRes],
      ] as const
    ).flatMap(([source, res]): RouteSource[] => (res.status === 'rejected' ? [source] : []));
    if (failed.length) notices.push({ kind: 'partialFailure', failed });
    if (transitRes.status === 'fulfilled' && drafts.length === 0 && injected.length === 0) {
      notices.push({ kind: 'transitUnavailable' });
    } else if (
      (drafts.length > 0 || injected.length > 0) &&
      !metroInService(istMinutes(at)) &&
      // Google may still have a late metro after our (unverified) last train: don't contradict it.
      !googleDrafts.some((d) => d.legs.some((l) => l.mode === 'metro'))
    ) {
      notices.push({ kind: 'metroClosed' });
    }
    googleDrafts.forEach((d, i) =>
      routes.push(transitToRoute(`transit-${i}`, d, at, drive?.traffic ?? 'Light')),
    );
    routes.push(...injected);

    if (drive) {
      routes.push(roadRoute('auto', 'auto', drive, autoFare(drive.distanceKm, at)));
      const cab = cabFare(drive.distanceKm, drive.durationSec / 60);
      routes.push(roadRoute('cab', 'cab', drive, cab.mid, `₹${cab.min}–${cab.max} est.`));
      if (vehicles.car)
        routes.push(roadRoute('car', 'car', drive, fuelCost('car', drive.distanceKm)));
    }
    if (bike) routes.push(roadRoute('bike', 'bike', bike, fuelCost('bike', bike.distanceKm)));
    if (
      walkRes.status === 'fulfilled' &&
      walkRes.value.durationSec <= routingConfig.maxWalkOnlyMin * 60
    ) {
      routes.push(walkRoute(walkRes.value));
    }

    const result = { routes: scoreRoutes(routes), notices };
    cache.set(key, result);
    return { ...result, googleAt };
  }

  const defaultPriority = () =>
    deps.preferences
      .get()
      .then((p) => p.defaultPriority)
      .catch((): Priority => 'fastest');

  return {
    async getRoutes(from, to, { priority, vehicles, departAt, signal }) {
      const [{ routes, notices, googleAt }, aiPriority] = await Promise.all([
        candidates(from, to, vehicles, signal, departAt),
        defaultPriority(),
      ]);
      // Keep every route that is in the top N for some priority, so callers can
      // re-rank locally for another priority without refetching.
      const keep = new Set(
        PRIORITIES.flatMap((p) =>
          rankRoutes(routes, p, vehicles)
            .slice(0, routingConfig.maxResults)
            .map((r) => r.id),
        ),
      );
      const ranked = withAiPick(rankRoutes(routes, priority, vehicles), aiPriority).filter(
        (r) => keep.has(r.id) || r.aiPick,
      );
      return {
        routes: ranked.map((r, i): RankedRoute => ({ ...r, rank: i + 1, isBest: i === 0 })),
        notices,
        googleAt,
      };
    },

    async getPreview(from, to) {
      const prefs = await deps.preferences.get();
      const { routes } = await candidates(from, to, prefs.vehicles);
      const shown = withAiPick(
        rankRoutes(routes, prefs.defaultPriority, prefs.vehicles),
        prefs.defaultPriority,
      );
      const ai = shown.find((r) => r.aiPick);
      const cheapest = [...shown].sort((a, b) => a.costInr - b.costInr)[0];
      const fastest = [...shown].sort((a, b) => a.durationMin - b.durationMin)[0];
      const picks: Route[] = [];
      for (const r of [ai, cheapest, fastest]) {
        if (r && !picks.some((p) => p.id === r.id)) picks.push(r);
      }
      return picks;
    },

    searchPlaces: (query) => deps.places.searchPlaces(query),
    geocode: (name) => deps.places.geocode(name),
  };
}
