import { LruCache } from './lruCache';
import { istMinutes } from './transit/time';
import type { LatLng, Leg } from './types';

/**
 * Bus ETA v0 (docs/bus-eta-spec.md): Google's scheduled bus times, the ride
 * stretched by current road traffic between the two stops. PMPML has no open
 * real-time feed and Google's TRANSIT response carries no real-time field, so
 * nothing here is "live". This is the baseline a learned delay model must beat.
 * TODO(ml): the delay model replaces `trafficFactor` × `margin`.
 */
export const busEtaConfig = {
  /** Identifies these predictions in bus_eta_predictions.model. */
  model: 'baseline_v0',
  /** DRIVE duration / staticDuration between the stops, clamped to this. */
  trafficFactor: { min: 1, max: 2.5 },
  /** Ride range: high = predicted × (1 + margin). */
  margin: { peak: 0.35, off_peak: 0.2, night: 0.15 },
  /** IST hours, [from, to). */
  peakHours: [
    [8, 11],
    [17, 21],
  ],
  /** IST hours from 21:00 to 05:59 (the evening peak ends at 21:00). */
  nightHours: { from: 21, to: 6 },
  /**
   * Arrival at your stop: from the scheduled departure to this many minutes later.
   * A placeholder (no data behind it yet); the ground-truth logs (Phase 3) will set it.
   */
  lateMin: { peak: 5, off_peak: 3, night: 2 },
  /** Only the bus legs of the top N ranked routes get a traffic call. */
  topRoutes: 3,
  /** Traffic factors are reused per stop pair within this bucket. */
  cacheBucketMin: 15,
} as const;

export type HourBand = keyof typeof busEtaConfig.margin;
/** 'scheduled': schedule only (traffic call failed, pending, or not a top route). */
export type BusEtaSource = 'scheduled' | 'scheduled_traffic';

/** A Google bus leg with everything the estimate needs. */
export interface BusLeg {
  /** Short name ("115"); null when Google has none. */
  line: string | null;
  fromStop: string;
  toStop: string;
  from: LatLng;
  to: LatLng;
  /** Scheduled, ISO 8601. */
  departureAt: string;
  arrivalAt: string;
}

export interface BusEta {
  source: BusEtaSource;
  /** Clamped; null when schedule only. */
  trafficFactor: number | null;
  /** Of the scheduled departure. */
  hourBand: HourBand;
  scheduledRideMin: number;
  /** In-vehicle minutes: low = scheduled × factor, high = low × (1 + margin). */
  rideLowMin: number;
  rideHighMin: number;
  /** When the bus should reach your stop (epoch ms): scheduled → + late window. */
  departLowAt: number;
  departHighAt: number;
}

const BUCKET_MS = busEtaConfig.cacheBucketMin * 60_000;
const keyOf = (p: LatLng) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;

/** The leg as a bus leg with known stops and scheduled times; null otherwise. */
export function busLegOf(leg: Leg): BusLeg | null {
  if (leg.mode !== 'bus' || !leg.departureAt || !leg.arrivalAt) return null;
  if (!leg.fromLocation || !leg.toLocation) return null;
  const dep = Date.parse(leg.departureAt);
  const arr = Date.parse(leg.arrivalAt);
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return null;
  return {
    line: leg.lineShortName ?? null,
    fromStop: leg.from ?? '',
    toStop: leg.to ?? '',
    from: leg.fromLocation,
    to: leg.toLocation,
    departureAt: leg.departureAt,
    arrivalAt: leg.arrivalAt,
  };
}

/** One bus (stops + scheduled departure): the same leg in several routes shares it. */
export const busLegKey = (leg: BusLeg) => `${keyOf(leg.from)}>${keyOf(leg.to)}|${leg.departureAt}`;

export function hourBand(at: Date): HourBand {
  const hour = Math.floor(istMinutes(at) / 60);
  const { nightHours, peakHours } = busEtaConfig;
  if (hour >= nightHours.from || hour < nightHours.to) return 'night';
  return peakHours.some(([from, to]) => hour >= from && hour < to) ? 'peak' : 'off_peak';
}

export const clampTrafficFactor = (ratio: number) =>
  Math.min(busEtaConfig.trafficFactor.max, Math.max(busEtaConfig.trafficFactor.min, ratio));

/** The estimate for `leg`; `trafficFactor` null (unknown) gives the schedule-only one. */
export function estimateBusLeg(leg: BusLeg, trafficFactor: number | null): BusEta {
  const dep = Date.parse(leg.departureAt);
  const scheduledRideMin = (Date.parse(leg.arrivalAt) - dep) / 60_000;
  const band = hourBand(new Date(dep));
  const factor = trafficFactor === null ? null : clampTrafficFactor(trafficFactor);
  const rideLowMin = scheduledRideMin * (factor ?? 1);
  return {
    source: factor === null ? 'scheduled' : 'scheduled_traffic',
    trafficFactor: factor,
    hourBand: band,
    scheduledRideMin,
    rideLowMin,
    rideHighMin: rideLowMin * (1 + busEtaConfig.margin[band]),
    departLowAt: dep,
    departHighAt: dep + busEtaConfig.lateMin[band] * 60_000,
  };
}

/** Road duration / static duration from `from` to `to` leaving at `at`; null when unknown. */
export type FetchTrafficRatio = (from: LatLng, to: LatLng, at: Date) => Promise<number | null>;

export interface BusEtaService {
  /** Clamped traffic factor for the leg's stretch; null when unavailable. Never throws. */
  trafficFactor(leg: BusLeg): Promise<number | null>;
}

/** `fetchRatio` null (no Google key): every estimate is schedule-only. */
export function createBusEtaService(fetchRatio: FetchTrafficRatio | null): BusEtaService {
  /** Per stop pair and 15-min bucket of the departure (successes only: failures retry). */
  const cache = new LruCache<string, number>(100);
  const inflight = new Map<string, Promise<number | null>>();

  return {
    async trafficFactor(leg) {
      if (!fetchRatio) return null;
      const dep = Date.parse(leg.departureAt);
      const key = `${keyOf(leg.from)}>${keyOf(leg.to)}|${Math.floor(dep / BUCKET_MS)}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const running = inflight.get(key);
      if (running) return running;

      const request = fetchRatio(leg.from, leg.to, new Date(dep))
        .then((ratio) => {
          if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return null;
          const factor = clampTrafficFactor(ratio);
          cache.set(key, factor);
          return factor;
        })
        .catch((e: unknown) => {
          if (__DEV__) console.warn('[busEta] traffic call failed', e);
          return null;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, request);
      if (__DEV__) console.info(`[busEta] traffic call: ${leg.fromStop} → ${leg.toStop}`);
      return request;
    },
  };
}
