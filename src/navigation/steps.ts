/**
 * One step list for every route we show: Google Routes legs (walk / road
 * legs split into Google's turn-by-turn steps) and our timetable metro /
 * local-train legs, whose instructions we write ourselves.
 */
import { busLegOf, type BusLeg } from '@/services/busEta';
import type { LatLng, Leg, Mode, Route, RouteDataSource } from '@/services/types';
import { modeColors } from '@/theme/routly';

import { pathLengthM } from './geo';

export type { LatLng };

export type NavKind = 'walk' | 'transit' | 'drive' | 'two_wheeler';

export interface NavStep {
  id: string;
  kind: NavKind;
  /** Human text: "Walk 350 m to PCMC Metro Station". */
  instruction: string;
  polyline: LatLng[];
  endPoint: LatLng;
  distanceM: number;
  predictedDurationS: number;
  source: RouteDataSource;
  /** Index of the route leg this step belongs to (logging groups steps per leg). */
  legIndex: number;
  /** The leg's mode ("auto", "cab", "bike"…): `kind` alone can't tell an auto from a cab. */
  legMode: Mode;
  /** Google's maneuver for this step ("TURN_LEFT"), when known. */
  maneuver?: string;
  /** The user's own car / bike (off-route applies; not to a hired auto or cab). */
  ownVehicle?: boolean;
  transit?: {
    mode: 'metro' | 'train' | 'bus';
    line: string;
    lineColor?: string;
    headsign?: string;
    boardStop: string;
    alightStop: string;
    /** ISO. */
    scheduledDep?: string;
    stopCount: number;
    /** Board stop … alight stop, when known (timetable legs): "get off at next stop" alerts. */
    stopsLatLng?: LatLng[];
    /** Google bus legs: what the bus ETA needs (busEta.ts). */
    bus?: BusLeg;
  };
}

const KIND: Record<Mode, NavKind> = {
  walk: 'walk',
  metro: 'transit',
  train: 'transit',
  bus: 'transit',
  auto: 'drive',
  cab: 'drive',
  bike: 'two_wheeler',
  cycle: 'two_wheeler',
};

/** "350 m", "1.2 km". */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(Math.round(m / 100) / 10).toFixed(1).replace(/\.0$/, '')} km`;
}

/** "Metro Purple Line", "Bus 208B"; a timetable train ("Train · to Lonavala") → "local train". */
function lineName(leg: Leg): string {
  const base = leg.label.split(' · ')[0] ?? leg.label;
  if (leg.mode === 'train' && base === 'Train') return 'local train';
  if (leg.mode === 'bus' && base === 'Bus') return 'bus';
  return base;
}

function roadInstruction(leg: Leg, target: string, ownVehicle: boolean): string {
  switch (leg.mode) {
    case 'auto':
      return `Take an auto to ${target}`;
    case 'cab':
      return ownVehicle ? `Drive to ${target}` : `Take a cab to ${target}`;
    case 'bike':
      return `Ride to ${target}`;
    case 'cycle':
      return `Cycle to ${target}`;
    default:
      return `Walk ${leg.distanceKm ? `${formatDistance(leg.distanceKm * 1000)} ` : ''}to ${target}`;
  }
}

const isTransit = (leg: Leg | undefined) =>
  leg?.mode === 'metro' || leg?.mode === 'train' || leg?.mode === 'bus';

/**
 * `route` → navigation steps. Walk and road legs with Google's turn-by-turn
 * steps become one step each (Google's text); other legs one step with our
 * own instruction. A walk between two rides with no path (an interchange
 * inside the station) becomes "Change to … at …".
 */
export function routeToSteps(
  route: Pick<Route, 'id' | 'legs' | 'source' | 'vehicle'>,
  destination: { name: string; location: LatLng },
): NavStep[] {
  const steps: NavStep[] = [];
  route.legs.forEach((leg, i) => {
    const prev = route.legs[i - 1];
    const next = route.legs[i + 1];
    const path = leg.polyline ?? [];
    const fallbackEnd = next?.polyline?.[0] ?? destination.location;
    const endPoint = path[path.length - 1] ?? fallbackEnd;
    // Access / egress legs of a timetable route come from Google.
    const source: RouteDataSource = leg.realtime === false ? 'routly_timetable' : 'google';
    const legSec = leg.durationMin * 60;
    const base = {
      kind: KIND[leg.mode],
      legIndex: i,
      legMode: leg.mode,
      source,
      ...(route.vehicle && leg.mode !== 'walk' ? { ownVehicle: true } : {}),
    };
    const id = (n: number) => `${route.id}:${i}:${n}`;

    if (isTransit(leg)) {
      const mode = leg.mode as 'metro' | 'train' | 'bus';
      const line = lineName(leg);
      const boardStop = leg.from ?? prev?.to ?? 'the stop';
      const alightStop = leg.to ?? next?.from ?? destination.name;
      const stopCount = leg.stops ?? 0;
      // Timetable paths are the station coordinates, board → alight.
      const stopsLatLng =
        leg.realtime === false && stopCount > 0 && path.length === stopCount + 1 ? path : undefined;
      const towards = leg.headsign ? ` towards ${leg.headsign}` : '';
      const stopsText = stopCount ? ` (${stopCount} stop${stopCount === 1 ? '' : 's'})` : '';
      steps.push({
        ...base,
        id: id(0),
        instruction: `Board the ${line}${towards} at ${boardStop}. Get off at ${alightStop}${stopsText}`,
        polyline: path,
        endPoint,
        distanceM: leg.distanceKm !== undefined ? leg.distanceKm * 1000 : pathLengthM(path),
        predictedDurationS: legSec,
        transit: {
          mode,
          line,
          lineColor: leg.lineColor ?? (mode === 'train' ? modeColors.train.line : undefined),
          headsign: leg.headsign,
          boardStop,
          alightStop,
          scheduledDep: leg.departureAt,
          stopCount,
          stopsLatLng,
          bus: busLegOf(leg) ?? undefined,
        },
      });
      return;
    }

    const target = isTransit(next) ? (next?.from ?? 'the stop') : destination.name;
    if (leg.mode === 'walk' && isTransit(prev) && isTransit(next) && path.length < 2) {
      steps.push({
        ...base,
        id: id(0),
        instruction: `Change to the ${lineName(next!)} at ${next!.from ?? prev!.to ?? 'the station'}`,
        polyline: path,
        endPoint: next?.polyline?.[0] ?? endPoint,
        distanceM: 0,
        predictedDurationS: legSec,
      });
      return;
    }

    const sub = !leg.approximate ? (leg.steps ?? []).filter((s) => s.polyline.length > 1) : [];
    if (sub.length) {
      const subSec = sub.reduce((s, x) => s + x.durationSec, 0);
      const subM = sub.reduce((s, x) => s + x.distanceM, 0);
      sub.forEach((s, n) => {
        // Google's step times add up to the leg; when they don't, share the leg's time by distance.
        const share = subSec > 0 ? s.durationSec / subSec : subM > 0 ? s.distanceM / subM : 0;
        steps.push({
          ...base,
          id: id(n),
          instruction: s.instruction,
          maneuver: s.maneuver,
          polyline: s.polyline,
          endPoint: s.polyline[s.polyline.length - 1]!,
          distanceM: s.distanceM,
          predictedDurationS: Math.round(legSec * share),
        });
      });
      return;
    }

    steps.push({
      ...base,
      id: id(0),
      instruction: roadInstruction(leg, target, route.vehicle === 'car'),
      polyline: path,
      endPoint,
      distanceM: leg.distanceKm !== undefined ? leg.distanceKm * 1000 : pathLengthM(path),
      predictedDurationS: legSec,
    });
  });
  return steps;
}

/** Same mode family for reroutes: walk, transit, a hired ride, own car, own two-wheeler. */
export function modeFamily(route: Pick<Route, 'legs' | 'vehicle'>): string {
  if (route.legs.some((l) => isTransit(l))) return 'transit';
  if (route.vehicle) return route.vehicle;
  const ride = route.legs.find((l) => l.mode !== 'walk');
  return ride ? ride.mode : 'walk';
}

/**
 * The new route after a reroute: the best-ranked option of the same family,
 * preferring one with the same main transit mode (metro stays metro).
 */
export function pickReroute<R extends Pick<Route, 'legs' | 'vehicle'>>(
  original: Pick<Route, 'legs' | 'vehicle'>,
  ranked: R[],
): R | null {
  const family = modeFamily(original);
  const same = ranked.filter((r) => modeFamily(r) === family);
  const mainMode = (r: Pick<Route, 'legs'>) => r.legs.find((l) => isTransit(l))?.mode;
  return same.find((r) => mainMode(r) === mainMode(original)) ?? same[0] ?? null;
}
