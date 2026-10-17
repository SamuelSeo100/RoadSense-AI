import metroJson from '../../../data/transit/metro.json';
import suburbanJson from '../../../data/transit/suburban_rail.json';
import type { LatLng } from '../types';

import type {
  FareSlab,
  MetroLine,
  MetroNetwork,
  Sourced,
  SuburbanNetwork,
  TransitStation,
} from './types';

/** The bundled timetables (data/transit). Tests pass their own networks instead. */
export const metroNetwork = metroJson as unknown as MetroNetwork;
export const suburbanNetwork = suburbanJson as unknown as SuburbanNetwork;

export const valueOf = <T>(s: Sourced<T> | undefined): T | null => s?.value ?? null;

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const stationPoint = (s: TransitStation): LatLng | null =>
  s.lat === null || s.lng === null ? null : { latitude: s.lat, longitude: s.lng };

export const isOpen = (s: TransitStation) => s.open !== false;

/** Straight-line km along stations[from..to] (either order); null if a coordinate is missing. */
export function pathKm(stations: TransitStation[], from: number, to: number): number | null {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  let km = 0;
  for (let i = lo; i < hi; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    const pa = a && stationPoint(a);
    const pb = b && stationPoint(b);
    if (!pa || !pb) return null;
    km += haversineKm(pa, pb);
  }
  return km;
}

/**
 * Fare for `amount` (stations or km) from a slab table. Null when the slab's
 * fare is unknown. `verified` only when that slab is.
 */
export function slabFare(
  slabs: FareSlab[],
  amount: number,
): { fare: number; verified: boolean } | null {
  const slab = slabs.find((s) => s.upTo === null || amount <= s.upTo) ?? slabs[slabs.length - 1];
  const fare = valueOf(slab?.fare);
  return slab && fare !== null ? { fare, verified: slab.fare.verified } : null;
}

export interface NearStation<S extends TransitStation = TransitStation> {
  /** Display name; one entry per physical station ("Civil Court" covers both lines). */
  name: string;
  /** Station ids with this name (one per line). */
  ids: string[];
  point: LatLng;
  km: number;
  station: S;
}

/**
 * Up to `k` nearest physical stations within `maxKm` (straight line), open
 * and with coordinates. Stations on several lines count once.
 */
export function nearestStations<S extends TransitStation>(
  point: LatLng,
  stations: S[],
  { maxKm, k }: { maxKm: number; k: number },
): NearStation<S>[] {
  const byName = new Map<string, NearStation<S>>();
  for (const s of stations) {
    const p = stationPoint(s);
    if (!p || !isOpen(s)) continue;
    const km = haversineKm(point, p);
    if (km > maxKm) continue;
    const seen = byName.get(s.name);
    if (seen) {
      seen.ids.push(s.id);
      if (km < seen.km) Object.assign(seen, { km, point: p, station: s });
    } else {
      byName.set(s.name, { name: s.name, ids: [s.id], point: p, km, station: s });
    }
  }
  return [...byName.values()].sort((a, b) => a.km - b.km).slice(0, k);
}

/** Stations of the lines that are routed (`active`). */
export const activeMetroStations = (network: MetroNetwork) =>
  network.lines.filter((l) => l.active).flatMap((l) => l.stations);

export function lineOf(network: MetroNetwork, stationId: string) {
  for (const line of network.lines) {
    const index = line.stations.findIndex((s) => s.id === stationId);
    if (index >= 0) return { line, index };
  }
  return null;
}

/**
 * Comparable station name: "Ramwadi Metro Station" → "ramwadi", "Shivaji
 * Nagar" and "Shivajinagar" → "shivajinagar" (spaces dropped).
 */
export function normaliseStationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(metro|railway|rail|station|stn|jn|junction)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Our station for a Google Transit stop name, on `line` when given. Matches
 * the name, its aliases, or a name given in brackets ("Bhosari (Nashik Phata)").
 */
export function matchMetroStation(
  network: MetroNetwork,
  stopName: string | undefined,
  line?: MetroLine,
): { line: MetroLine; index: number } | null {
  if (!stopName) return null;
  const wanted = normaliseStationName(stopName);
  if (!wanted) return null;
  for (const l of line ? [line] : network.lines) {
    const index = l.stations.findIndex((s) =>
      [s.name, ...(s.aliases ?? [])].some((n) => normaliseStationName(n) === wanted),
    );
    if (index >= 0) return { line: l, index };
  }
  return null;
}

/** Our line for a Google label ("Metro Purple Line" → Purple Line). */
export function matchMetroLine(network: MetroNetwork, label: string | undefined): MetroLine | null {
  if (!label) return null;
  const l = label.toLowerCase();
  return (
    network.lines.find((line) => {
      const colour = line.name.toLowerCase().replace(/ line$/, '');
      return l.includes(line.name.toLowerCase()) || (colour.length > 2 && l.includes(colour));
    }) ?? null
  );
}
