import type { Priority, Route, TrafficLevel } from './types';

type Metric = 'time' | 'cost' | 'walk' | 'transfers';

/**
 * v1 heuristic weights: each priority's own metric gets ≥ 0.6, the rest break
 * ties. 'cheapest' is 0.85 so that ₹9 cheaper always wins, even against an
 * option that is best on every other metric (0.85 × 9/50 > 0.15).
 * TODO(ml): the learned ranker replaces this whole module.
 */
export const scoringConfig = {
  weights: {
    fastest: { time: 0.7, cost: 0.1, walk: 0.1, transfers: 0.1 },
    cheapest: { time: 0.05, cost: 0.85, walk: 0.05, transfers: 0.05 },
    // Cost 0.25 so a ₹300+ auto doesn't win "least walking" just by having no walk.
    walking: { time: 0.15, cost: 0.25, walk: 0.6, transfers: 0 },
    transfers: { time: 0.15, cost: 0.25, walk: 0, transfers: 0.6 },
  } satisfies Record<Priority, Record<Metric, number>>,
  /**
   * How far behind the best option counts as "as bad as it gets" (score 1) per
   * metric. Fixed scales instead of min-max: with min-max a ₹400 cab squashed
   * a ₹20-vs-₹25 difference to ~1% and cost could not dominate.
   */
  scales: { time: 60, cost: 50, walk: 2, transfers: 2 } satisfies Record<Metric, number>,
  /** Share of a road route in SLOW / TRAFFIC_JAM above which traffic is Moderate / Heavy. */
  traffic: { moderateShare: 0.15, heavyShare: 0.35 },
} as const;

type Scorable = Pick<Route, 'durationMin' | 'costInr' | 'walkingKm' | 'transfers'>;

const metricOf: Record<Metric, (r: Scorable) => number> = {
  time: (r) => r.durationMin,
  cost: (r) => r.costInr,
  walk: (r) => r.walkingKm,
  transfers: (r) => r.transfers,
};
const METRICS = Object.keys(metricOf) as Metric[];

/** 0..1 (0 = best): distance from the best candidate over a fixed scale, capped at 1. */
function normaliser(values: number[], scale: number): (v: number) => number {
  const min = Math.min(...values);
  return (v) => Math.min(1, Math.max(0, (v - min) / scale));
}

/** Per-priority scores (lower = better), relative to the other candidates. */
export function scoreRoutes<T extends Scorable>(
  routes: T[],
  weights: Record<Priority, Record<Metric, number>> = scoringConfig.weights,
  scales: Record<Metric, number> = scoringConfig.scales,
): (T & { score: Record<Priority, number> })[] {
  const norm = Object.fromEntries(
    METRICS.map((m) => [m, normaliser(routes.map(metricOf[m]), scales[m])]),
  ) as Record<Metric, (v: number) => number>;
  return routes.map((r) => {
    const score = {} as Record<Priority, number>;
    for (const p of Object.keys(weights) as Priority[]) {
      score[p] = METRICS.reduce((sum, m) => sum + weights[p][m] * norm[m](metricOf[m](r)), 0);
    }
    return { ...r, score };
  });
}

/** Index of the best route for `priority`, or -1 when there are none. */
export function bestIndex(routes: Pick<Route, 'score'>[], priority: Priority): number {
  let best = -1;
  routes.forEach((r, i) => {
    if (best < 0 || r.score[priority] < (routes[best]?.score[priority] ?? Infinity)) best = i;
  });
  return best;
}

export type SpeedReading = 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';

/**
 * Traffic from Routes API speed intervals: share of the path (by point-to-point
 * length) that is SLOW or TRAFFIC_JAM. `segmentKm[i]` is the length from point i to i+1.
 */
export function trafficLevel(
  intervals: { start: number; end: number; speed: SpeedReading }[],
  segmentKm: number[],
  cfg: { moderateShare: number; heavyShare: number } = scoringConfig.traffic,
): TrafficLevel {
  const total = segmentKm.reduce((a, b) => a + b, 0);
  if (total <= 0) return 'Light';
  let slow = 0;
  for (const { start, end, speed } of intervals) {
    if (speed === 'NORMAL') continue;
    for (let i = start; i < end; i++) slow += segmentKm[i] ?? 0;
  }
  const share = slow / total;
  if (share >= cfg.heavyShare) return 'Heavy';
  if (share >= cfg.moderateShare) return 'Moderate';
  return 'Light';
}
