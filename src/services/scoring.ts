import type { Priority, Route, TrafficLevel } from './types';

type Metric = 'time' | 'cost' | 'walk' | 'transfers';

/**
 * v1 heuristic weights: each priority's own metric dominates, the rest break
 * ties. TODO(ml): the learned ranker replaces this whole module.
 */
export const scoringConfig = {
  weights: {
    fastest: { time: 0.7, cost: 0.1, walk: 0.1, transfers: 0.1 },
    cheapest: { time: 0.15, cost: 0.65, walk: 0.1, transfers: 0.1 },
    walking: { time: 0.15, cost: 0.1, walk: 0.65, transfers: 0.1 },
    transfers: { time: 0.15, cost: 0.1, walk: 0.1, transfers: 0.65 },
  } satisfies Record<Priority, Record<Metric, number>>,
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

/** Min-max normalised 0..1 (0 = best). All-equal values normalise to 0. */
function normaliser(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  return (v) => (span > 0 ? (v - min) / span : 0);
}

/** Per-priority scores (lower = better), relative to the other candidates. */
export function scoreRoutes<T extends Scorable>(
  routes: T[],
  weights: Record<Priority, Record<Metric, number>> = scoringConfig.weights,
): (T & { score: Record<Priority, number> })[] {
  const norm = Object.fromEntries(
    METRICS.map((m) => [m, normaliser(routes.map(metricOf[m]))]),
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
