/**
 * Demo simulation (dev / preview builds only): replays a trip's step
 * polylines as fake GPS fixes at realistic speeds per mode. Pure: the hook
 * advances the simulated clock and feeds `simulatedFix` to the engine.
 */
import type { Mode } from '@/services/types';

import type { Fix } from './engine';
import { distanceM } from './geo';
import type { LatLng, NavStep } from './steps';

export const simConfig = {
  speedKmh: {
    walk: 5,
    bus: 18,
    metro: 35,
    train: 45,
    auto: 22,
    cab: 25,
    bike: 22,
    cycle: 14,
  } satisfies Record<Mode, number>,
  /** Standing at the boarding stop before the vehicle leaves (simulated seconds). */
  boardDwellS: 30,
  /** One fake fix per real second. */
  tickMs: 1000,
  /** Playback speeds the screen cycles through. */
  speeds: [1, 4, 16],
  accuracyM: 5,
} as const;

/** The simulated position at `t` simulated seconds, and the speed reported there. */
interface Keyframe {
  t: number;
  p: LatLng;
  /** m/s of the segment ending here (0 while waiting). */
  speed: number;
}

/** Keyframes along the whole trip: every step polyline, gaps walked, a wait before each ride. */
export function simulationPlan(steps: readonly NavStep[], destination: LatLng): Keyframe[] {
  const first = steps.find((s) => s.polyline.length > 0)?.polyline[0] ?? destination;
  const frames: Keyframe[] = [{ t: 0, p: first, speed: 0 }];
  const walk = simConfig.speedKmh.walk / 3.6;
  const goTo = (p: LatLng, speed: number) => {
    const last = frames[frames.length - 1]!;
    const d = distanceM(last.p, p);
    if (d < 0.5) return;
    frames.push({ t: last.t + d / speed, p, speed });
  };
  for (const step of steps) {
    const mode = step.transit?.mode ?? step.legMode;
    const speed = simConfig.speedKmh[mode] / 3.6;
    const path = step.polyline.length > 1 ? step.polyline : [step.endPoint];
    // Gaps between steps (interchanges, approximate geometry) are walked.
    if (path.length > 1) goTo(path[0]!, walk);
    if (step.transit) {
      const last = frames[frames.length - 1]!;
      frames.push({ t: last.t + simConfig.boardDwellS, p: last.p, speed: 0 });
    }
    for (const p of path.length > 1 ? path.slice(1) : path) goTo(p, speed);
  }
  goTo(destination, walk);
  return frames;
}

/** Duration of the plan in simulated seconds. */
export const planDurationS = (plan: readonly Keyframe[]) => plan[plan.length - 1]?.t ?? 0;

function bearing(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.longitude - a.longitude) * rad) * Math.cos(b.latitude * rad);
  const x =
    Math.cos(a.latitude * rad) * Math.sin(b.latitude * rad) -
    Math.sin(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.cos((b.longitude - a.longitude) * rad);
  return (((Math.atan2(y, x) / rad) % 360) + 360) % 360;
}

/**
 * The fake fix at simulated second `simS`, stamped with the real clock `now`
 * (the engine times everything from fix times). Speed is the mode's real speed,
 * not the playback-multiplied one, so boarding detection behaves as on a real trip.
 */
export function simulatedFix(plan: readonly Keyframe[], simS: number, now: number): Fix {
  const last = plan[plan.length - 1]!;
  let i = plan.findIndex((k) => k.t >= simS);
  if (i < 0) i = plan.length - 1;
  const b = plan[i]!;
  const a = plan[Math.max(0, i - 1)]!;
  const span = b.t - a.t;
  const f = span > 0 ? Math.min(1, Math.max(0, (simS - a.t) / span)) : 1;
  const p =
    simS >= last.t
      ? last.p
      : {
          latitude: a.p.latitude + f * (b.p.latitude - a.p.latitude),
          longitude: a.p.longitude + f * (b.p.longitude - a.p.longitude),
        };
  return {
    lat: p.latitude,
    lng: p.longitude,
    accuracy: simConfig.accuracyM,
    speed: simS >= last.t ? 0 : b.speed,
    heading: b.speed > 0 ? bearing(a.p, b.p) : null,
    t: now,
  };
}
