import { isOpen, lineOf, metroNetwork, pathKm, slabFare, valueOf } from './network';
import { parseHHMM } from './time';
import type { MetroLine, MetroNetwork } from './types';

/** 'forward' = towards the last station in `line.stations`. */
export type MetroDirection = 'forward' | 'reverse';

interface Timing {
  /** Run minutes per segment, in the direction of travel. */
  seg: number[];
  dwellMin: number;
  /** Open flag per station, in the direction of travel. */
  open: boolean[];
}

/** Null when a required value is unknown (the line can't be timed). */
function timing(line: MetroLine, direction: MetroDirection): Timing | null {
  const seg = line.segmentMinutes.map(valueOf);
  const dwellSec = valueOf(line.dwellSeconds);
  if (dwellSec === null || seg.some((m) => m === null)) return null;
  const open = line.stations.map(isOpen);
  const forward = { seg: seg as number[], dwellMin: dwellSec / 60, open };
  return direction === 'forward'
    ? forward
    : { ...forward, seg: [...forward.seg].reverse(), open: [...open].reverse() };
}

/** Minutes from the terminal departure to the train's arrival at position `j`. */
function arrivalOffset(t: Timing, j: number): number {
  let min = 0;
  for (let i = 0; i < j; i++) {
    min += t.seg[i] ?? 0;
    // Dwell at every open station passed before j (not the terminal).
    if (i > 0 && t.open[i]) min += t.dwellMin;
  }
  return min;
}

/** Minutes from the terminal departure to the train leaving position `j`. */
const departureOffset = (t: Timing, j: number) =>
  j === 0 ? 0 : arrivalOffset(t, j) + (t.open[j] ? t.dwellMin : 0);

const terminalCache = new WeakMap<MetroLine, number[] | null>();

/**
 * Departures from either terminal (minutes after midnight): first train,
 * then every headway of the band the previous train left in, up to the last
 * train. Null when the hours or a needed headway are unknown.
 */
export function terminalDepartures(line: MetroLine): number[] | null {
  if (terminalCache.has(line)) return terminalCache.get(line) ?? null;
  const first = parseHHMM(valueOf(line.firstTrain));
  const last = parseHHMM(valueOf(line.lastTrain));
  let result: number[] | null = null;
  if (first !== null && last !== null) {
    const bands = line.headways.map((b) => ({
      from: parseHHMM(b.from),
      to: parseHHMM(b.to),
      headway: valueOf(b.headwayMin),
    }));
    const out: number[] = [];
    let t = first;
    while (t <= last) {
      out.push(t);
      const band = bands.find((b) => b.from !== null && b.to !== null && t >= b.from && t < b.to);
      if (!band?.headway || band.headway <= 0) break;
      t += band.headway;
    }
    // A gap in the bands ends the day early: service stops where the data does.
    result = out.length ? out : null;
  }
  terminalCache.set(line, result);
  return result;
}

export interface MetroDeparture {
  /** Minutes after midnight the train leaves `station`. */
  departure: number;
  waitMin: number;
  /** When that train left its terminal. */
  terminalDeparture: number;
}

/**
 * Next train from `stationId` towards `direction` at or after `time` (minutes
 * after IST midnight). Null outside service hours, on inactive lines, at
 * closed stations, or at the terminal the direction ends at.
 */
export function nextMetroDeparture(
  line: MetroLine,
  stationId: string,
  direction: MetroDirection,
  time: number,
): MetroDeparture | null {
  if (!line.active) return null;
  const fwdIndex = line.stations.findIndex((s) => s.id === stationId);
  if (fwdIndex < 0) return null;
  const j = direction === 'forward' ? fwdIndex : line.stations.length - 1 - fwdIndex;
  const t = timing(line, direction);
  const departures = terminalDepartures(line);
  if (!t || !departures || !t.open[j] || j >= line.stations.length - 1) return null;
  const offset = departureOffset(t, j);
  const td = departures.find((d) => d + offset >= time - 1e-9);
  if (td === undefined) return null;
  const departure = td + offset;
  return { departure, waitMin: departure - time, terminalDeparture: td };
}

export interface MetroRideLeg {
  line: MetroLine;
  fromIndex: number;
  toIndex: number;
  direction: MetroDirection;
  departure: number;
  arrival: number;
  /** Open stations travelled (boarding excluded, alighting included). */
  stations: number;
  /** Straight-line km between stations; null if a coordinate is missing. */
  km: number | null;
}

function rideOnLine(
  line: MetroLine,
  fromIndex: number,
  toIndex: number,
  time: number,
): MetroRideLeg | null {
  if (fromIndex === toIndex || !line.stations[toIndex] || !isOpen(line.stations[toIndex])) {
    return null;
  }
  const direction: MetroDirection = toIndex > fromIndex ? 'forward' : 'reverse';
  const fromId = line.stations[fromIndex]?.id ?? '';
  const next = nextMetroDeparture(line, fromId, direction, time);
  const t = timing(line, direction);
  if (!next || !t) return null;
  const n = line.stations.length - 1;
  const jTo = direction === 'forward' ? toIndex : n - toIndex;
  const [lo, hi] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
  const passed = line.stations.slice(lo, hi + 1);
  const stations = (fromIndex < toIndex ? passed.slice(1) : passed.slice(0, -1)).filter(
    isOpen,
  ).length;
  return {
    line,
    fromIndex,
    toIndex,
    direction,
    departure: next.departure,
    arrival: next.terminalDeparture + arrivalOffset(t, jTo),
    stations,
    km: pathKm(line.stations, fromIndex, toIndex),
  };
}

export interface MetroFare {
  fare: number;
  /** True only when every slab used is verified. */
  verified: boolean;
}

/**
 * One fare for the trip: legs on lines sharing a fare system are summed into
 * one journey ('single_journey'); Line 3 has its own table.
 */
export function metroJourneyFare(
  legs: Pick<MetroRideLeg, 'line' | 'stations' | 'km'>[],
  network: MetroNetwork = metroNetwork,
): MetroFare | null {
  const { fares } = network;
  const groups = new Map<string, typeof legs>();
  for (const leg of legs) {
    const system = leg.line.id === 'line3' && fares.line3 ? 'line3' : 'main';
    const parts = fares.interchange === 'per_line' ? `${system}:${leg.line.id}` : system;
    groups.set(parts, [...(groups.get(parts) ?? []), leg]);
  }
  let total = 0;
  let verified = true;
  for (const [key, group] of groups) {
    const slabs = key.startsWith('line3') && fares.line3 ? fares.line3.slabs : fares.slabs;
    let amount = 0;
    for (const leg of group) {
      const v = fares.basis === 'km' ? leg.km : leg.stations;
      if (v === null) return null;
      amount += v;
    }
    const f = slabFare(slabs, amount);
    if (!f) return null;
    total += f.fare;
    verified &&= f.verified;
  }
  return { fare: total, verified };
}

export interface MetroRide {
  legs: MetroRideLeg[];
  /** Before the first train. */
  waitMin: number;
  /** On trains (incl. dwell). */
  rideMin: number;
  /** Interchange walk + wait for the second train. */
  transferMin: number;
  /** Interchange walk alone (0 when direct). */
  interchangeWalkMin: number;
  /** Minutes after midnight at the exit station. */
  arrival: number;
  fare: MetroFare | null;
}

/**
 * Station to station at `departTime` (minutes after IST midnight): same line,
 * or one interchange (earliest arrival wins). Null when there is no train.
 */
export function metroRide(
  fromId: string,
  toId: string,
  departTime: number,
  network: MetroNetwork = metroNetwork,
): MetroRide | null {
  const from = lineOf(network, fromId);
  const to = lineOf(network, toId);
  if (!from || !to || !from.line.active || !to.line.active) return null;

  const options: { legs: MetroRideLeg[]; walk: number }[] = [];
  if (from.line === to.line) {
    const leg = rideOnLine(from.line, from.index, to.index, departTime);
    if (leg) options.push({ legs: [leg], walk: 0 });
  } else {
    for (const x of network.interchanges) {
      for (const [a, b] of [
        [x.a, x.b],
        [x.b, x.a],
      ] as const) {
        const ia = from.line.stations.findIndex((s) => s.id === a);
        const ib = to.line.stations.findIndex((s) => s.id === b);
        const walk = valueOf(x.walkMinutes);
        if (ia < 0 || ib < 0 || walk === null) continue;
        const first = rideOnLine(from.line, from.index, ia, departTime);
        const second = first && rideOnLine(to.line, ib, to.index, first.arrival + walk);
        if (first && second) options.push({ legs: [first, second], walk });
      }
    }
  }
  const arrivalOf = (o: { legs: MetroRideLeg[] }) => o.legs[o.legs.length - 1]?.arrival ?? 0;
  const best = options.sort((a, b) => arrivalOf(a) - arrivalOf(b))[0];
  const legs = best?.legs;
  const first = legs?.[0];
  const last = legs?.[legs.length - 1];
  if (!legs || !first || !last) return null;
  const rideMin = legs.reduce((s, l) => s + (l.arrival - l.departure), 0);
  return {
    legs,
    waitMin: first.departure - departTime,
    rideMin,
    transferMin: last.arrival - first.departure - rideMin,
    interchangeWalkMin: best?.walk ?? 0,
    arrival: last.arrival,
    fare: metroJourneyFare(legs, network),
  };
}

/** True when some active line has a train leaving a terminal at `time` or later today. */
export function metroInService(time: number, network: MetroNetwork = metroNetwork): boolean {
  return network.lines.some((line) => {
    if (!line.active) return false;
    const deps = terminalDepartures(line);
    const first = deps?.[0];
    const last = deps?.[deps.length - 1];
    return first !== undefined && last !== undefined && time >= first && time <= last;
  });
}
