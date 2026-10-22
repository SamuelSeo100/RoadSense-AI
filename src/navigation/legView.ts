/**
 * What the navigation cards say about legs (pure): stops left on a ride, the
 * transfer between two rides, and a one-line preview of the next leg.
 */
import type { Mode } from '@/services/types';

import { distanceM, pathLengthM, project } from './geo';
import { formatDistance, type LatLng, type NavStep } from './steps';

/** Stops this close past (along the line) still count as ahead (GPS / station size). */
const STOP_SLACK_M = 50;
/** Walks shorter than this between two rides are a change inside the station. */
const CHANGE_MAX_M = 30;

/**
 * Stops left before (and including) the alighting one: counted from the
 * stations when we know them (timetable legs), else estimated from the
 * progress along the line ("~"). Null when the ride has no stop count.
 */
export function stopsRemaining(
  step: NavStep,
  at: LatLng | null,
  progressM: number,
): { count: number; estimated: boolean } | null {
  const t = step.transit;
  if (!t || t.stopCount <= 0) return null;
  const stops = t.stopsLatLng;
  if (stops && stops.length >= 2 && at) {
    const here = project(stops, at);
    if (!here) return null;
    let along = 0;
    let count = 0;
    for (let i = 1; i < stops.length; i++) {
      along += distanceM(stops[i - 1]!, stops[i]!);
      if (along > here.alongM + STOP_SLACK_M) count++;
    }
    return { count: Math.max(1, count), estimated: false };
  }
  const total = step.polyline.length > 1 ? pathLengthM(step.polyline) : step.distanceM;
  const done = total > 0 ? Math.min(1, Math.max(0, progressM / total)) : 0;
  return { count: Math.max(1, Math.ceil(t.stopCount * (1 - done))), estimated: true };
}

/** Index of the next step on another leg, or -1. */
function nextLegIndex(steps: readonly NavStep[], index: number): number {
  const leg = steps[index]?.legIndex;
  return steps.findIndex((s, i) => i > index && s.legIndex !== leg);
}

/**
 * "Exit at Swargate → walk 200 m → Bus 13 at Shimla Office" for the change
 * between two rides: from a ride (the change after it) or from a walk step
 * between two rides. Null when there is no ride on both sides.
 */
export function transferText(steps: readonly NavStep[], index: number): string | null {
  const current = steps[index];
  if (!current) return null;
  let from = -1;
  if (current.kind === 'transit') from = index;
  else {
    for (let i = index - 1; i >= 0; i--) {
      if (steps[i]!.kind === 'transit') {
        from = i;
        break;
      }
      if (steps[i]!.kind !== 'walk') return null;
    }
  }
  if (from < 0) return null;
  let walkM = 0;
  for (let i = from + 1; i < steps.length; i++) {
    const s = steps[i]!;
    if (s.kind === 'transit') {
      const exit = steps[from]!.transit!.alightStop;
      const ride = `${s.transit!.line} at ${s.transit!.boardStop}`;
      return walkM < CHANGE_MAX_M
        ? `Exit at ${exit} → change to ${ride}`
        : `Exit at ${exit} → walk ${formatDistance(walkM)} → ${ride}`;
    }
    if (s.kind !== 'walk') return null;
    walkM += s.distanceM;
  }
  return null;
}

const ROAD_NAMES: Partial<Record<Mode, string>> = {
  auto: 'Auto',
  cab: 'Cab',
  bike: 'Ride',
  cycle: 'Cycle',
};

/** The next leg in one line ("Bus 115 towards Hinjewadi at Shimla Office"), or null at the last leg. */
export function nextLegPreview(
  steps: readonly NavStep[],
  index: number,
  destinationName: string,
): { mode: Mode; text: string } | null {
  const start = nextLegIndex(steps, index);
  const first = steps[start];
  if (!first) return null;
  if (first.transit) {
    const towards = first.transit.headsign ? ` towards ${first.transit.headsign}` : '';
    return {
      mode: first.transit.mode,
      text: `${first.transit.line}${towards} at ${first.transit.boardStop}`,
    };
  }
  const legSteps = steps.filter((s, i) => i >= start && s.legIndex === first.legIndex);
  const after = steps.find((s, i) => i >= start && s.legIndex !== first.legIndex);
  const target = after?.transit?.boardStop ?? destinationName;
  const metres = legSteps.reduce((sum, s) => sum + s.distanceM, 0);
  if (first.kind === 'walk') {
    return metres < CHANGE_MAX_M && after?.transit
      ? { mode: 'walk', text: `Change to the ${after.transit.line}` }
      : { mode: 'walk', text: `Walk ${formatDistance(metres)} to ${target}` };
  }
  const name = first.ownVehicle && first.legMode === 'cab' ? 'Drive' : ROAD_NAMES[first.legMode];
  return { mode: first.legMode, text: `${name ?? 'Go'} to ${target}` };
}
