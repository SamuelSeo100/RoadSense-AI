import type { Draft, DraftLeg } from '../google/googleRoutingService';
import type { LatLng, Route } from '../types';

import { metroJourneyFare, metroRide, type MetroRide } from './metro';
import {
  activeMetroStations,
  haversineKm,
  isOpen,
  matchMetroLine,
  matchMetroStation,
  metroNetwork,
  nearestStations,
  normaliseStationName,
  stationPoint,
  suburbanNetwork,
  type NearStation,
} from './network';
import { nextSuburbanDeparture, type SuburbanDeparture } from './suburban';
import { formatHHMM, istMinutes, istWeekday } from './time';
import type { MetroLine, MetroNetwork, SuburbanNetwork, TransitStation } from './types';

/** Tunables for timetable (metro / local train) options. */
export const injectionConfig = {
  /** Entry / exit stations are looked for within this straight-line distance, per system. */
  maxStationKm: { metro: 3, train: 3 },
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

const pathOf = (stations: TransitStation[], from: number, to: number): LatLng[] => {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const pts = stations
    .slice(lo, hi + 1)
    .map(stationPoint)
    .filter((p): p is LatLng => p !== null);
  return from <= to ? pts : pts.reverse();
};

function bestMetroRide(
  entry: NearStation,
  exit: NearStation,
  time: number,
  network: MetroNetwork,
): MetroRide | null {
  let best: MetroRide | null = null;
  for (const a of entry.ids) {
    for (const b of exit.ids) {
      const ride = metroRide(a, b, time, network);
      if (!ride) continue;
      if (
        !best ||
        ride.arrival < best.arrival ||
        (ride.arrival === best.arrival && ride.legs.length < best.legs.length)
      ) {
        best = ride;
      }
    }
  }
  return best;
}

function metroLegs(ride: MetroRide): DraftLeg[] {
  const out: DraftLeg[] = [];
  ride.legs.forEach((leg, i) => {
    const from = leg.line.stations[leg.fromIndex];
    const to = leg.line.stations[leg.toIndex];
    const prev = ride.legs[i - 1];
    if (prev) {
      // Interchange walk: straight line between the two stations (real path loads later).
      const prevStation = prev.line.stations[prev.toIndex];
      const a = prevStation && stationPoint(prevStation);
      const b = from && stationPoint(from);
      out.push({
        mode: 'walk',
        // Walking part only; the wait for the next train is in the route total.
        durationSec: ride.interchangeWalkMin * 60,
        distanceM: a && b ? haversineKm(a, b) * 1000 : 0,
        path: a && b ? [a, b] : [],
        approximate: true,
      });
    }
    const verified = ride.fare?.verified ?? false;
    out.push({
      mode: 'metro',
      durationSec: (leg.arrival - leg.departure) * 60,
      distanceM: (leg.km ?? 0) * 1000,
      path: pathOf(leg.line.stations, leg.fromIndex, leg.toIndex),
      approximate: false,
      label: metroLabel(leg.line),
      stops: leg.stations,
      fromStop: from?.name,
      toStop: to?.name,
      // One fare for the journey, on its first leg. Undefined = fares.ts fallback.
      fareInr: ride.fare ? (i === 0 ? ride.fare.fare : 0) : undefined,
      fareEstimated: !verified,
      realtime: false,
      lineColor: leg.line.color,
      departure: formatHHMM(leg.departure),
    });
  });
  return out;
}

function trainLeg(dep: SuburbanDeparture, network: SuburbanNetwork): DraftLeg {
  const from = network.stations[dep.fromIndex];
  const to = network.stations[dep.toIndex];
  const trip = network.trips.find((t) => t.trainNo === dep.trainNo);
  const [lo, hi] = [Math.min(dep.fromIndex, dep.toIndex), Math.max(dep.fromIndex, dep.toIndex)];
  const stops = trip
    ? trip.times.slice(lo, hi + 1).filter((t) => t !== null).length - 1
    : undefined;
  return {
    mode: 'train',
    durationSec: dep.rideMin * 60,
    distanceM: (dep.km ?? 0) * 1000,
    path: pathOf(network.stations, dep.fromIndex, dep.toIndex),
    approximate: false,
    label: `Train ${dep.trainNo}`,
    stops,
    fromStop: from?.name,
    toStop: to?.name,
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
  stations: TransitStation[];
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
        const r = bestMetroRide(entry, exit, time, metro);
        const first = r?.legs[0];
        return r && first
          ? { departure: first.departure, arrival: r.arrival, legs: metroLegs(r) }
          : null;
      },
    },
    {
      // No trips imported yet → no stations → no calls.
      maxKm: injectionConfig.maxStationKm.train,
      stations: suburban.trips.length ? suburban.stations.filter(isOpen) : [],
      ride(entry, exit, time) {
        const a = entry.ids[0];
        const b = exit.ids[0];
        const dep = a && b ? nextSuburbanDeparture(a, b, time, weekday, {}, suburban) : null;
        return dep
          ? { departure: dep.departure, arrival: dep.arrival, legs: [trainLeg(dep, suburban)] }
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
        if (entry.name === exit.name) return [];
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
    const key = `${dir}|${station.station.id}`;
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
 * Google metro legs on our lines keep Google's timing but take our fare
 * table (one fare per journey across an interchange) and the line colour.
 * Legs we can't match keep the fares.ts estimate.
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
    const run: number[] = [];
    let j = i;
    while (j < legs.length && (legs[j]?.mode === 'metro' || legs[j]?.mode === 'walk')) {
      if (legs[j]?.mode === 'metro') run.push(j);
      j++;
    }
    const matched = run.map((k) => {
      const leg = legs[k] as DraftLeg;
      const line = matchMetroLine(network, leg.label);
      const a = line ? matchMetroStation(network, leg.fromStop, line) : null;
      const b = line ? matchMetroStation(network, leg.toStop, line) : null;
      if (line) leg.lineColor = line.color;
      return line && a && b ? { line, a: a.index, b: b.index } : null;
    });
    if (matched.every((m) => m !== null) && matched.length) {
      const fare = metroJourneyFare(
        matched.map((m) => {
          const [lo, hi] = m.a < m.b ? [m.a, m.b] : [m.b, m.a];
          const passed = m.line.stations.slice(lo, hi + 1);
          const stations = (m.a < m.b ? passed.slice(1) : passed.slice(0, -1)).filter(
            isOpen,
          ).length;
          return { line: m.line, stations, km: null };
        }),
        network,
      );
      if (fare) {
        run.forEach((k, n) => {
          const leg = legs[k] as DraftLeg;
          leg.fareInr = n === 0 ? fare.fare : 0;
          leg.fareEstimated = !fare.verified;
        });
      }
    }
    i = j;
  }
  return { ...draft, legs };
}

/** Canonical station name: ours when it's a metro station we know. */
function canonicalStop(name: string | undefined, network: MetroNetwork): string {
  const ours = matchMetroStation(network, name);
  const station = ours?.line.stations[ours.index];
  return normaliseStationName(station?.name ?? name ?? '');
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
