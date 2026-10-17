import { suburbanNetwork } from './network';
import { parseHHMM } from './time';
import type { SuburbanNetwork, SuburbanTrip } from './types';

/** Per trip: stations whose times a `dataIssues` entry puts in doubt ('all' = whole trip). */
export type TripIssues = Map<string, { stations: Set<string> | 'all'; issues: string[] }>;

const issueCache = new WeakMap<SuburbanNetwork, { byTrip: TripIssues; unmatched: string[] }>();

/**
 * Reads `dataIssues` ("UP 10TH LOCAL: 19 min gap before LNL (13:50) - check",
 * "UP 17TH LOCAL: KK 19:16 is earlier than previous stop"). A gap or an
 * out-of-order time puts the named station and the stop before it in doubt;
 * anything else unrecognised flags the whole trip.
 */
export function tripIssues(network: SuburbanNetwork = suburbanNetwork) {
  const cached = issueCache.get(network);
  if (cached) return cached;
  const byTrip: TripIssues = new Map();
  const unmatched: string[] = [];
  for (const issue of network.dataIssues ?? []) {
    const m = /^(UP|DOWN)\s+(.+?):\s*(.*)$/.exec(issue.trim());
    const trip =
      m &&
      network.trips.find(
        (t) => t.direction === m[1] && t.label.toLowerCase() === (m[2] ?? '').toLowerCase(),
      );
    if (!m || !trip) {
      unmatched.push(issue);
      continue;
    }
    const detail = m[3] ?? '';
    const station =
      /\bgap before ([A-Z]+)\b/.exec(detail)?.[1] ??
      /^([A-Z]+) \d{1,2}:\d{2} is earlier than previous stop/.exec(detail)?.[1];
    const entry = byTrip.get(trip.id) ?? { stations: new Set<string>(), issues: [] };
    entry.issues.push(issue);
    const at = station ? trip.stops.findIndex((s) => s.station === station) : -1;
    if (at < 0) {
      entry.stations = 'all';
    } else if (entry.stations !== 'all') {
      entry.stations.add(station!);
      const prev = trip.stops[at - 1]?.station;
      if (prev) entry.stations.add(prev);
    }
    byTrip.set(trip.id, entry);
  }
  const result = { byTrip, unmatched };
  issueCache.set(network, result);
  return result;
}

/** Days of operation are still TODO_VERIFY (a string): every trip runs daily until then. */
const runsOn = (trip: SuburbanTrip, weekday: number | undefined) =>
  !Array.isArray(trip.days) || weekday === undefined || trip.days.includes(weekday);

/** ₹ for |km(to) − km(from)| from `fare.slabs` (provisional, `verified: false`). */
export function suburbanFare(
  fromCode: string,
  toCode: string,
  network: SuburbanNetwork = suburbanNetwork,
): { fare: number; verified: boolean; km: number } | null {
  const a = network.stations.find((s) => s.code === fromCode);
  const b = network.stations.find((s) => s.code === toCode);
  if (!a || !b) return null;
  const km = Math.abs(b.kmFromPune - a.kmFromPune);
  const slab = network.fare.slabs.find((s) => km <= s.maxKm);
  return slab ? { fare: slab.fareInr, verified: network.fare.verified, km } : null;
}

export interface SuburbanDeparture {
  tripId: string;
  label: string;
  direction: 'UP' | 'DOWN';
  /** Station code the train runs to. */
  terminus: string;
  /**
   * Minutes after midnight of the query day: may exceed 1440 (a train after
   * midnight) and is never before `time`.
   */
  departure: number;
  arrival: number;
  waitMin: number;
  rideMin: number;
  /** Stops travelled (boarding excluded). */
  stops: number;
  fare: { fare: number; verified: boolean; km: number } | null;
}

/**
 * Next trip that stops at `fromCode` then `toCode` (in its order of travel,
 * so short workings that don't reach a station are skipped), leaving at or
 * after `time` (minutes after IST midnight). Looks at trips that started
 * yesterday (still running past midnight via `dayOffset`), today and
 * tomorrow. Trips whose `dataIssues` touch either station are skipped.
 * Null when none leaves within `maxWaitMin`.
 */
export function nextSuburbanDeparture(
  fromCode: string,
  toCode: string,
  time: number,
  { maxWaitMin = Infinity, weekday }: { maxWaitMin?: number; weekday?: number } = {},
  network: SuburbanNetwork = suburbanNetwork,
): SuburbanDeparture | null {
  if (fromCode === toCode) return null;
  const { byTrip } = tripIssues(network);
  let best: Omit<SuburbanDeparture, 'fare'> | null = null;
  for (const trip of network.trips) {
    const i = trip.stops.findIndex((s) => s.station === fromCode);
    const j = trip.stops.findIndex((s) => s.station === toCode);
    if (i < 0 || j <= i) continue;
    const doubt = byTrip.get(trip.id)?.stations;
    if (doubt === 'all' || doubt?.has(fromCode) || doubt?.has(toCode)) continue;
    const a = trip.stops[i]!;
    const b = trip.stops[j]!;
    const depT = parseHHMM(a.time);
    const arrT = parseHHMM(b.time);
    if (depT === null || arrT === null) continue;
    const dep = depT + a.dayOffset * 1440;
    const arr = arrT + b.dayOffset * 1440;
    if (arr <= dep) continue;
    for (const dayShift of [-1, 0, 1]) {
      if (weekday !== undefined && !runsOn(trip, (((weekday + dayShift) % 7) + 7) % 7)) continue;
      const departure = dep + dayShift * 1440;
      if (departure < time - 1e-9 || departure - time > maxWaitMin) continue;
      if (best && departure >= best.departure) continue;
      best = {
        tripId: trip.id,
        label: trip.label,
        direction: trip.direction,
        terminus: trip.terminus,
        departure,
        arrival: arr + dayShift * 1440,
        waitMin: departure - time,
        rideMin: arr - dep,
        stops: j - i,
      };
    }
  }
  return best ? { ...best, fare: suburbanFare(fromCode, toCode, network) } : null;
}
