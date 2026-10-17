import metroJson from '../../../data/transit/metro.json';
import suburbanJson from '../../../data/transit/suburban_rail.json';
import type { LatLng } from '../types';

import type { Geocoded, MetroLine, MetroNetwork, Sourced, SuburbanNetwork } from './types';

/** The bundled data (data/transit). Tests pass their own networks instead. */
export const metroNetwork = metroJson as unknown as MetroNetwork;
export const suburbanNetwork = suburbanJson as unknown as SuburbanNetwork;

/** Credits shown in Profile › Settings › Data sources. */
export const transitDataCredits: string[] = [
  // "Local train timings: punelocaltraintimetable.com (Mahendra Gadmire)", used with permission.
  suburbanNetwork.source.credit,
  'Metro fares: Maha-Metro',
];

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

export const pointOf = (s: Geocoded | undefined): LatLng | null =>
  s?.lat == null || s.lng == null ? null : { latitude: s.lat, longitude: s.lng };

export interface NearStation {
  code: string;
  name: string;
  point: LatLng;
  /** Straight-line km from the query point. */
  km: number;
}

/** Up to `k` nearest stations within `maxKm` (straight line) that have coordinates. */
export function nearestStations(
  point: LatLng,
  stations: (Geocoded & { code: string; name: string })[],
  { maxKm, k }: { maxKm: number; k: number },
): NearStation[] {
  return stations
    .flatMap((s) => {
      const p = pointOf(s);
      const km = p ? haversineKm(point, p) : Infinity;
      return p && km <= maxKm ? [{ code: s.code, name: s.name, point: p, km }] : [];
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, k);
}

export const metroStation = (network: MetroNetwork, code: string) =>
  network.stations.find((s) => s.code === code);

/** Stations served by an active line. */
export function activeMetroStations(network: MetroNetwork) {
  const served = new Set(network.lines.filter((l) => l.active).flatMap((l) => l.stations));
  return network.stations.filter((s) => served.has(s.code));
}

/** Official fare between two stations (symmetric matrix), or null if the pair is missing. */
export function metroFare(
  from: string,
  to: string,
  network: MetroNetwork = metroNetwork,
): { fare: number; verified: boolean } | null {
  const fare = network.fares.matrix[from]?.[to] ?? network.fares.matrix[to]?.[from];
  return fare === undefined ? null : { fare, verified: network.fares.verified };
}

/**
 * Comparable station name: "Ramwadi Metro Station" → "ramwadi", "Shivaji
 * Nagar" and "Shivajinagar" → "shivajinagar", "R.T.O., Pune" → "rtopune".
 */
export function normaliseStationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(metro|railway|rail|station|stn|jn|junction)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Station code for a Google Transit stop name, preferring `line`. Matches the
 * name, its aliases, or a name in brackets ("Nashik Phata (Bhosari)").
 */
export function matchMetroStation(
  network: MetroNetwork,
  stopName: string | undefined,
  line?: MetroLine | null,
): string | null {
  if (!stopName) return null;
  const wanted = normaliseStationName(stopName);
  if (!wanted) return null;
  const names = (s: MetroNetwork['stations'][number]) => [
    s.name,
    ...(s.aliases ?? []),
    ...[...s.name.matchAll(/\((.*?)\)/g)].map((m) => m[1] ?? ''),
  ];
  const candidates = line
    ? network.stations.filter((s) => line.stations.includes(s.code))
    : network.stations;
  const hit = candidates.find((s) => names(s).some((n) => normaliseStationName(n) === wanted));
  return hit?.code ?? null;
}

/** Our line for a Google label ("Metro Purple Line" → purple). */
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
