import { haversineKm, metroFare, metroNetwork, metroStation, pointOf, valueOf } from './network';
import { parseHHMM } from './time';
import type { MetroLine, MetroNetwork } from './types';

/** 'forward' = towards the last station in `line.stations`. */
export type MetroDirection = 'forward' | 'reverse';

interface Timing {
  /** Run minutes per segment, in the direction of travel. */
  seg: number[];
  dwellMin: number;
}

/** Null when a required value is unknown (the line can't be timed). */
function timing(line: MetroLine, direction: MetroDirection): Timing | null {
  const seg = line.segmentMinutes.map(valueOf);
  const dwellSec = valueOf(line.dwellSeconds);
  if (dwellSec === null || seg.length !== line.stations.length - 1 || seg.some((m) => m === null)) {
    return null;
  }
  const ordered = direction === 'forward' ? (seg as number[]) : [...(seg as number[])].reverse();
  return { seg: ordered, dwellMin: dwellSec / 60 };
}

/** Minutes from leaving the terminal to arriving at position `j` (dwell at every stop between). */
function arrivalOffset(t: Timing, j: number): number {
  let min = 0;
  for (let i = 0; i < j; i++) min += (t.seg[i] ?? 0) + (i > 0 ? t.dwellMin : 0);
  return min;
}

const departureOffset = (t: Timing, j: number) => (j === 0 ? 0 : arrivalOffset(t, j) + t.dwellMin);

/** Headway (min) of the band covering `time`, else off-peak; null if unknown. */
export function headwayAt(line: MetroLine, time: number): number | null {
  const band = line.headways.find((b) => {
    const from = parseHHMM(b.from);
    const to = parseHHMM(b.to);
    return from !== null && to !== null && time >= from && time < to;
  });
  const h = band ? valueOf(band.headwayMin) : valueOf(line.offPeakHeadwayMin);
  return h !== null && h > 0 ? h : null;
}

export interface MetroDeparture {
  /** Minutes after IST midnight the train is expected at the station. */
  departure: number;
  /** Expected wait: half the headway (or until the first train). */
  waitMin: number;
  headwayMin: number;
}

/**
 * Expected next train from `code` towards `direction` at `time` (minutes
 * after IST midnight). There is no published minute-by-minute timetable, so
 * the wait is half the headway in service; before the first train it is the
 * time until that train reaches the station. Null after the last train has
 * passed, on inactive lines, or at the terminal the direction ends at.
 */
export function nextMetroDeparture(
  line: MetroLine,
  code: string,
  direction: MetroDirection,
  time: number,
): MetroDeparture | null {
  if (!line.active) return null;
  const index = line.stations.indexOf(code);
  const n = line.stations.length;
  if (index < 0) return null;
  const j = direction === 'forward' ? index : n - 1 - index;
  const t = timing(line, direction);
  const first = parseHHMM(valueOf(line.firstTrain));
  const last = parseHHMM(valueOf(line.lastTrain));
  if (!t || first === null || last === null || j >= n - 1) return null;
  const offset = departureOffset(t, j);
  const firstHere = first + offset;
  const lastHere = last + offset;
  if (time > lastHere + 1e-9) return null;
  const headwayMin = headwayAt(line, Math.max(first, time - offset));
  if (headwayMin === null) return null;
  const departure = time < firstHere ? firstHere : Math.min(time + headwayMin / 2, lastHere);
  return { departure, waitMin: departure - time, headwayMin };
}

export interface MetroRideLeg {
  line: MetroLine;
  from: string;
  to: string;
  direction: MetroDirection;
  departure: number;
  arrival: number;
  /** Stations travelled. */
  stations: number;
  /** Straight-line km between consecutive stations; null if a coordinate is missing. */
  km: number | null;
}

function lineKm(network: MetroNetwork, line: MetroLine, a: number, b: number): number | null {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let km = 0;
  for (let i = lo; i < hi; i++) {
    const p = pointOf(metroStation(network, line.stations[i] ?? ''));
    const q = pointOf(metroStation(network, line.stations[i + 1] ?? ''));
    if (!p || !q) return null;
    km += haversineKm(p, q);
  }
  return km;
}

function rideOnLine(
  network: MetroNetwork,
  line: MetroLine,
  from: string,
  to: string,
  time: number,
): MetroRideLeg | null {
  const a = line.stations.indexOf(from);
  const b = line.stations.indexOf(to);
  if (a < 0 || b < 0 || a === b) return null;
  const direction: MetroDirection = b > a ? 'forward' : 'reverse';
  const next = nextMetroDeparture(line, from, direction, time);
  const t = timing(line, direction);
  if (!next || !t) return null;
  const n = line.stations.length - 1;
  const [ja, jb] = direction === 'forward' ? [a, b] : [n - a, n - b];
  return {
    line,
    from,
    to,
    direction,
    departure: next.departure,
    arrival: next.departure + arrivalOffset(t, jb) - departureOffset(t, ja),
    stations: Math.abs(b - a),
    km: lineKm(network, line, a, b),
  };
}

export interface MetroRide {
  legs: MetroRideLeg[];
  /** Before the first train. */
  waitMin: number;
  /** On trains (incl. dwell). */
  rideMin: number;
  /** Interchange walk + expected wait for the second train. */
  transferMin: number;
  /** Interchange walk alone (0 when direct). */
  interchangeWalkMin: number;
  /** Minutes after IST midnight at the exit station. */
  arrival: number;
  /** From the official matrix (one fare across the interchange). */
  fare: { fare: number; verified: boolean } | null;
}

/**
 * Station to station (codes) at `departTime` (minutes after IST midnight):
 * same line, or one interchange (CVC). Earliest arrival wins. Null when no
 * train runs.
 */
export function metroRide(
  fromCode: string,
  toCode: string,
  departTime: number,
  network: MetroNetwork = metroNetwork,
): MetroRide | null {
  if (fromCode === toCode) return null;
  const lines = network.lines.filter((l) => l.active);
  const options: { legs: MetroRideLeg[]; walk: number }[] = [];
  for (const line of lines) {
    if (!line.stations.includes(fromCode) || !line.stations.includes(toCode)) continue;
    const leg = rideOnLine(network, line, fromCode, toCode, departTime);
    if (leg) options.push({ legs: [leg], walk: 0 });
  }
  if (!options.length) {
    for (const x of network.interchanges) {
      const walk = valueOf(x.walkMinutes);
      if (walk === null || x.station === fromCode || x.station === toCode) continue;
      const inX = lines.filter((l) => x.lines.includes(l.id) && l.stations.includes(x.station));
      for (const a of inX.filter((l) => l.stations.includes(fromCode))) {
        for (const b of inX.filter((l) => l !== a && l.stations.includes(toCode))) {
          const first = rideOnLine(network, a, fromCode, x.station, departTime);
          const second = first && rideOnLine(network, b, x.station, toCode, first.arrival + walk);
          if (first && second) options.push({ legs: [first, second], walk });
        }
      }
    }
  }
  const arrivalOf = (o: { legs: MetroRideLeg[] }) => o.legs[o.legs.length - 1]?.arrival ?? 0;
  const best = options.sort((a, b) => arrivalOf(a) - arrivalOf(b))[0];
  const first = best?.legs[0];
  const last = best?.legs[best.legs.length - 1];
  if (!best || !first || !last) return null;
  const rideMin = best.legs.reduce((s, l) => s + (l.arrival - l.departure), 0);
  return {
    legs: best.legs,
    waitMin: first.departure - departTime,
    rideMin,
    transferMin: last.arrival - first.departure - rideMin,
    interchangeWalkMin: best.walk,
    arrival: last.arrival,
    fare: metroFare(fromCode, toCode, network),
  };
}

/** True between the first and last train (terminal departures) on some active line. */
export function metroInService(time: number, network: MetroNetwork = metroNetwork): boolean {
  return network.lines.some((line) => {
    const first = parseHHMM(valueOf(line.firstTrain));
    const last = parseHHMM(valueOf(line.lastTrain));
    return line.active && first !== null && last !== null && time >= first && time <= last;
  });
}
