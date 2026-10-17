import type { Draft, DraftLeg } from '../google/googleRoutingService';
import type { LatLng, Route } from '../types';

import { metroRide, type MetroRide } from './metro';
import {
  activeMetroStations,
  matchMetroLine,
  matchMetroStation,
  metroFare,
  metroNetwork,
  metroStation,
  nearestStations,
  normaliseStationName,
  pointOf,
  suburbanNetwork,
  type NearStation,
} from './network';
import { nextSuburbanDeparture, type SuburbanDeparture } from './suburban';
import { formatHHMM, istMinutes, istWeekday } from './time';
import type { MetroLine, MetroNetwork, SuburbanNetwork } from './types';

/** Tunables for timetable (metro / local train) options. */
export const injectionConfig = {
  /** Entry / exit stations are looked for within this straight-line distance, per system. */
  maxStationKm: { metro: 3, train: 6 },
  /** Per system: at most this many entry × exit stations (bounds Google calls to 2 + 2). */
  maxEntry: 2,
  maxExit: 2,
  /** Access / egress up to this (straight line) is walked, else an auto. */
  walkMaxKm: 1.2,
  /** Closer than this to the station: no access leg (and no API call). */
  minAccessKm: 0.05,
  /** Straight line → street distance and speeds, only to pre-screen pairs before any call. */
  roadFactor: 1.3,
  walkSpeedKmh: 4.8,
  autoSpeedKmh: 20,
  autoPickupMin: 3,
} as const;

/** A walk or auto between a point and a station, from Google Routes. */
export interface AccessLeg {
  mode: 'walk' | 'auto';
  durationSec: number;
  distanceM: number;
  path: LatLng[];
  approximate: boolean;
}

/** Null when Google has no route (that station is then skipped). */
export type FetchAccess = (
  from: LatLng,
  to: LatLng,
  mode: 'walk' | 'auto',
) => Promise<AccessLeg | null>;

const accessMode = (km: number) => (km <= injectionConfig.walkMaxKm ? 'walk' : 'auto');

/** Rough minutes for a point → station leg, used only to skip pairs with no service. */
function estimateAccessMin(km: number): number {
  if (km < injectionConfig.minAccessKm) return 0;
  const road = km * injectionConfig.roadFactor;
  return accessMode(km) === 'walk'
    ? (road / injectionConfig.walkSpeedKmh) * 60
    : injectionConfig.autoPickupMin + (road / injectionConfig.autoSpeedKmh) * 60;
}

const metroLabel = (line: MetroLine) => `Metro ${line.name.replace(/\s*\(.*\)$/, '')}`;

/** Station coordinates from `from` to `to` along `codes` (either direction). */
function pathAlong(
  codes: string[],
  from: string,
  to: string,
  pointFor: (code: string) => LatLng | null,
): LatLng[] {
  const a = codes.indexOf(from);
  const b = codes.indexOf(to);
  if (a < 0 || b < 0) return [];
  const slice = a <= b ? codes.slice(a, b + 1) : codes.slice(b, a + 1).reverse();
  return slice.map(pointFor).filter((p): p is LatLng => p !== null);
}

function metroLegs(ride: MetroRide, network: MetroNetwork): DraftLeg[] {
  const out: DraftLeg[] = [];
  const nameOf = (code: string) => metroStation(network, code)?.name ?? code;
  const pointFor = (code: string) => pointOf(metroStation(network, code));
  ride.legs.forEach((leg, i) => {
    if (i > 0) {
      // Interchange inside CVC; the wait for the next train is in the route total.
      out.push({
        mode: 'walk',
        durationSec: ride.interchangeWalkMin * 60,
        distanceM: 0,
        path: [],
        approximate: false,
      });
    }
    out.push({
      mode: 'metro',
      durationSec: (leg.arrival - leg.departure) * 60,
      distanceM: (leg.km ?? 0) * 1000,
      path: pathAlong(leg.line.stations, leg.from, leg.to, pointFor),
      approximate: false,
      label: metroLabel(leg.line),
      stops: leg.stations,
      fromStop: nameOf(leg.from),
      toStop: nameOf(leg.to),
      // One matrix fare for the journey, on its first leg. Undefined = fares.ts fallback.
      fareInr: ride.fare ? (i === 0 ? ride.fare.fare : 0) : undefined,
      fareEstimated: !(ride.fare?.verified ?? false),
      realtime: false,
      lineColor: leg.line.color,
      departure: formatHHMM(leg.departure),
    });
  });
  return out;
}

function trainLeg(
  dep: SuburbanDeparture,
  from: string,
  to: string,
  network: SuburbanNetwork,
): DraftLeg {
  const station = (code: string) => network.stations.find((s) => s.code === code);
  const codes = network.stations.map((s) => s.code);
  return {
    mode: 'train',
    durationSec: dep.rideMin * 60,
    distanceM: (dep.fare?.km ?? 0) * 1000,
    path: pathAlong(codes, from, to, (c) => pointOf(station(c))),
    approximate: false,
    // "Train · to Lonavala": the strip shows "Train", the steps the direction.
    label: `Train · to ${station(dep.terminus)?.name ?? dep.terminus}`,
    stops: dep.stops,
    fromStop: station(from)?.name,
    toStop: station(to)?.name,
    fareInr: dep.fare?.fare,
    fareEstimated: !(dep.fare?.verified ?? false),
    realtime: false,
    departure: formatHHMM(dep.departure),
  };
}

const toDraftLeg = (leg: AccessLeg, station: string, end: 'first' | 'last'): DraftLeg => ({
  ...leg,
  label: leg.mode === 'auto' ? `Auto ${end === 'first' ? 'to' : 'from'} ${station}` : undefined,
});

interface Ride {
  /** Minutes after midnight the first vehicle leaves. */
  departure: number;
  /** Minutes after midnight at the exit station. */
  arrival: number;
  legs: DraftLeg[];
}

interface System {
  maxKm: number;
  stations: {
    code: string;
    name: string;
    lat?: number | null;
    lng?: number | null;
    geocoded: boolean;
  }[];
  ride: (entry: NearStation, exit: NearStation, time: number) => Ride | null;
}

/**
 * Metro and local-train options from our timetables: k-nearest entry / exit
 * stations, Google Routes walk or auto access and egress (≤ 2 + 2 calls per
 * system, only for pairs with a train), then access + wait + ride (+
 * interchange) + egress. Trains leaving more than `maxWaitMin` after you can
 * reach the station are dropped.
 */
export async function timetableDrafts({
  from,
  to,
  at,
  fetchAccess,
  maxWaitMin,
  metro = metroNetwork,
  suburban = suburbanNetwork,
}: {
  from: LatLng;
  to: LatLng;
  at: Date;
  fetchAccess: FetchAccess;
  maxWaitMin: number;
  metro?: MetroNetwork;
  suburban?: SuburbanNetwork;
}): Promise<Draft[]> {
  const now = istMinutes(at);
  const weekday = istWeekday(at);
  const systems: System[] = [
    {
      maxKm: injectionConfig.maxStationKm.metro,
      stations: activeMetroStations(metro),
      ride(entry, exit, time) {
        const r = metroRide(entry.code, exit.code, time, metro);
        const first = r?.legs[0];
        return r && first
          ? { departure: first.departure, arrival: r.arrival, legs: metroLegs(r, metro) }
          : null;
      },
    },
    {
      maxKm: injectionConfig.maxStationKm.train,
      // No trips → no stations → no calls.
      stations: suburban.trips.length ? suburban.stations : [],
      ride(entry, exit, time) {
        const dep = nextSuburbanDeparture(entry.code, exit.code, time, { weekday }, suburban);
        return dep
          ? {
              departure: dep.departure,
              arrival: dep.arrival,
              legs: [trainLeg(dep, entry.code, exit.code, suburban)],
            }
          : null;
      },
    },
  ];

  // 1. Candidate pairs that have a train (estimated access), before any API call.
  const plans = systems.flatMap((system) => {
    const entries = nearestStations(from, system.stations, {
      maxKm: system.maxKm,
      k: injectionConfig.maxEntry,
    });
    const exits = nearestStations(to, system.stations, {
      maxKm: system.maxKm,
      k: injectionConfig.maxExit,
    });
    return entries.flatMap((entry) =>
      exits.flatMap((exit) => {
        if (entry.code === exit.code) return [];
        const reach = now + estimateAccessMin(entry.km);
        const ride = system.ride(entry, exit, reach);
        return ride && ride.departure - reach <= maxWaitMin ? [{ system, entry, exit }] : [];
      }),
    );
  });
  if (!plans.length) return [];

  // 2. Access / egress legs from Google, one call per distinct (point, station).
  const legCache = new Map<string, Promise<AccessLeg | null>>();
  const access = (point: LatLng, station: NearStation, dir: 'in' | 'out') => {
    const key = `${dir}|${station.code}`;
    let p = legCache.get(key);
    if (!p) {
      p =
        station.km < injectionConfig.minAccessKm
          ? Promise.resolve(null)
          : fetchAccess(
              dir === 'in' ? point : station.point,
              dir === 'in' ? station.point : point,
              accessMode(station.km),
            ).catch(() => null);
      legCache.set(key, p);
    }
    return p;
  };
  const resolved = await Promise.all(
    plans.map(async (plan) => ({
      ...plan,
      accessLeg: await access(from, plan.entry, 'in'),
      egressLeg: await access(to, plan.exit, 'out'),
    })),
  );

  // 3. Full options with the real access time.
  const drafts: Draft[] = [];
  for (const { system, entry, exit, accessLeg, egressLeg } of resolved) {
    // A failed call for a far station: skip it (a missing leg is fine only when we're at the station).
    if (!accessLeg && entry.km >= injectionConfig.minAccessKm) continue;
    if (!egressLeg && exit.km >= injectionConfig.minAccessKm) continue;
    const reach = now + (accessLeg?.durationSec ?? 0) / 60;
    const ride = system.ride(entry, exit, reach);
    if (!ride) continue;
    const waitMin = ride.departure - reach;
    if (waitMin > maxWaitMin) continue;
    const egressSec = egressLeg?.durationSec ?? 0;
    const durationSec = (ride.arrival - now) * 60 + egressSec;
    drafts.push({
      legs: [
        ...(accessLeg ? [toDraftLeg(accessLeg, entry.name, 'first')] : []),
        ...ride.legs,
        ...(egressLeg ? [toDraftLeg(egressLeg, exit.name, 'last')] : []),
      ],
      durationSec,
      rideSec: durationSec - waitMin * 60,
      googleFareInr: null,
      transitUnchanged: false,
      source: 'routly_timetable',
    });
  }
  return drafts;
}

/**
 * Google metro legs on our lines keep Google's timing but take the official
 * fare matrix (one fare per journey across the CVC interchange) and the line
 * colour. Legs we can't match keep the fares.ts estimate.
 */
export function applyMetroTable(draft: Draft, network: MetroNetwork = metroNetwork): Draft {
  const legs = draft.legs.map((l) => ({ ...l }));
  let i = 0;
  while (i < legs.length) {
    if (legs[i]?.mode !== 'metro') {
      i++;
      continue;
    }
    // One journey: metro legs joined only by walks (an interchange).
    const run: DraftLeg[] = [];
    let j = i;
    while (j < legs.length && (legs[j]?.mode === 'metro' || legs[j]?.mode === 'walk')) {
      if (legs[j]?.mode === 'metro') run.push(legs[j]!);
      j++;
    }
    const codes = run.map((leg) => {
      const line = matchMetroLine(network, leg.label);
      if (line) leg.lineColor = line.color;
      const a = matchMetroStation(network, leg.fromStop, line);
      const b = matchMetroStation(network, leg.toStop, line);
      return a && b ? { a, b } : null;
    });
    const from = codes[0]?.a;
    const to = codes[codes.length - 1]?.b;
    const fare = codes.every((c) => c !== null) && from && to ? metroFare(from, to, network) : null;
    if (fare) {
      run.forEach((leg, n) => {
        leg.fareInr = n === 0 ? fare.fare : 0;
        leg.fareEstimated = !fare.verified;
      });
    }
    i = j;
  }
  return { ...draft, legs };
}

/** Canonical stop: the station code when it's a metro station we know. */
function canonicalStop(name: string | undefined, network: MetroNetwork): string {
  return matchMetroStation(network, name) ?? normaliseStationName(name ?? '');
}

/** Mode sequence + boarding / alighting stations: equal = near-duplicate options. */
export function stationSignature(draft: Draft, network: MetroNetwork = metroNetwork): string {
  return draft.legs
    .map((l) =>
      l.mode === 'metro' || l.mode === 'train' || l.mode === 'bus'
        ? `${l.mode}:${canonicalStop(l.fromStop, network)}>${canonicalStop(l.toStop, network)}`
        : l.mode,
    )
    .filter((s, i, all) => !(s === 'walk' && all[i - 1] === 'walk'))
    .join('|');
}

/**
 * Google and timetable options with the same station and mode sequence are
 * the same trip: keep only the faster one (door to door); a tie keeps Google's.
 */
export function mergeNearDuplicates(
  google: Draft[],
  timetable: Draft[],
  network: MetroNetwork = metroNetwork,
): { google: Draft[]; timetable: Draft[] } {
  const fastestGoogle = new Map<string, number>();
  for (const d of google) {
    const sig = stationSignature(d, network);
    fastestGoogle.set(sig, Math.min(fastestGoogle.get(sig) ?? Infinity, d.durationSec));
  }
  // Fastest timetable copy per signature (only one can beat Google's).
  const fastestOurs = new Map<string, Draft>();
  for (const d of timetable) {
    const sig = stationSignature(d, network);
    const kept = fastestOurs.get(sig);
    if (!kept || d.durationSec < kept.durationSec) fastestOurs.set(sig, d);
  }
  const winners = new Set<string>();
  const keptTimetable = timetable.filter((d) => {
    const sig = stationSignature(d, network);
    const theirs = fastestGoogle.get(sig);
    if (theirs === undefined) return true;
    if (fastestOurs.get(sig) === d && d.durationSec < theirs) {
      winners.add(sig);
      return true;
    }
    return false;
  });
  return {
    google: google.filter((d) => !winners.has(stationSignature(d, network))),
    timetable: keptTimetable,
  };
}

type Comparable = Pick<Route, 'durationMin' | 'costInr' | 'walkingKm'>;

/** True when `a` is no worse than `b` on time, cost and walking, and better on one. */
export const dominates = (a: Comparable, b: Comparable) =>
  a.durationMin <= b.durationMin &&
  a.costInr <= b.costInr &&
  a.walkingKm <= b.walkingKm &&
  (a.durationMin < b.durationMin || a.costInr < b.costInr || a.walkingKm < b.walkingKm);

/** Drops options another one beats on time, cost and walking. */
export function dropDominated<T extends Comparable>(routes: T[]): T[] {
  return routes.filter((r) => !routes.some((o) => o !== r && dominates(o, r)));
}
