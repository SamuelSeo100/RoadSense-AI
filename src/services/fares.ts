/**
 * Fare estimates for Pune, in ₹. Pure functions over one config object.
 *
 * VERIFY: every rate below must be checked against the current Pune RTO
 * (auto / cab) notification, Maha-Metro's Pune fare table and PMPML's stage
 * fare chart before release. Fuel costs follow the Pune petrol price.
 */
export const fareConfig = {
  /** Pune/PCMC RTA auto meter revision effective 2026-09-01. Verify on next RTO revision. */
  auto: {
    /** Meter minimum, covers the first `baseKm`. */
    baseFare: 30,
    baseKm: 1.5,
    perKm: 20,
    /** Multiplier on the meter fare between `nightStartHour` and `nightEndHour` (local time). */
    nightSurcharge: 0.25,
    nightStartHour: 0,
    nightEndHour: 5,
  },
  cab: {
    baseFare: 50,
    perKm: 14,
    perMin: 1.5,
    minFare: 120,
    /** Shown as a range: estimate × these factors (surge, pricing variance). */
    rangeLow: 0.85,
    rangeHigh: 1.25,
  },
  fuelPerKm: {
    /** ~₹105/L petrol at ~45 km/L. */
    bike: 2.3,
    /** ~₹105/L petrol at ~15 km/L. */
    car: 7,
  },
  /**
   * Maha-Metro Pune: fare by stops travelled (Google's `stopCount`, upper
   * bound → ₹). Calibrated on 2 published fares: Civil Court → PCMC (9 stops)
   * = ₹20 and Vanaz → Ruby Hall (11 stops) = ₹25. Distance can't fit both
   * (13.2 km is ₹20 but 9.0 km is ₹25).
   * TODO(fares): station-to-station table from punemetrorail.org.
   */
  metroStopSlabs: [
    { upToStops: 3, fare: 10 },
    { upToStops: 6, fare: 15 },
    { upToStops: 9, fare: 20 },
    { upToStops: 12, fare: 25 },
    { upToStops: 16, fare: 30 },
    { upToStops: Infinity, fare: 35 },
  ],
  /** Fallback by leg distance (km → ₹), only when Google gives no `stopCount`. */
  metroSlabs: [
    { upToKm: 2, fare: 10 },
    { upToKm: 4, fare: 15 },
    { upToKm: 8, fare: 20 },
    { upToKm: 12, fare: 25 },
    { upToKm: 18, fare: 30 },
    { upToKm: Infinity, fare: 35 },
  ],
  /**
   * Metro discount for students and on weekends (fraction off). Off until a
   * profile flag exists; not applied anywhere yet.
   * TODO(fares): wire `enabled` to a student / weekend profile flag.
   */
  metroConcession: { rate: 0.3, enabled: false },
  /** PMPML: one stage = `stageKm`, ₹`perStage` per started stage (₹10 minimum). */
  bus: { stageKm: 5, perStage: 10 },
} as const;

export interface FareRange {
  /** Midpoint, used for ranking. */
  mid: number;
  min: number;
  max: number;
}

const round = (n: number) => Math.round(n);

export function isAutoNight(at: Date, cfg = fareConfig.auto): boolean {
  const h = at.getHours();
  return h >= cfg.nightStartHour && h < cfg.nightEndHour;
}

export function autoFare(distanceKm: number, at: Date, cfg = fareConfig.auto): number {
  const meter = cfg.baseFare + Math.max(0, distanceKm - cfg.baseKm) * cfg.perKm;
  return round(isAutoNight(at, cfg) ? meter * (1 + cfg.nightSurcharge) : meter);
}

export function cabFare(distanceKm: number, durationMin: number, cfg = fareConfig.cab): FareRange {
  const estimate = Math.max(
    cfg.minFare,
    cfg.baseFare + distanceKm * cfg.perKm + durationMin * cfg.perMin,
  );
  const min = round(estimate * cfg.rangeLow);
  const max = round(estimate * cfg.rangeHigh);
  return { mid: round((min + max) / 2), min, max };
}

export function fuelCost(
  vehicle: 'bike' | 'car',
  distanceKm: number,
  cfg = fareConfig.fuelPerKm,
): number {
  return round(distanceKm * cfg[vehicle]);
}

/** By stop count when known (calibrated), else by distance. */
export function metroFare(
  distanceKm: number,
  stops?: number,
  cfg: Pick<typeof fareConfig, 'metroSlabs' | 'metroStopSlabs'> = fareConfig,
): number {
  if (stops !== undefined && stops > 0) {
    const bySlab = cfg.metroStopSlabs.find((s) => stops <= s.upToStops);
    return (bySlab ?? cfg.metroStopSlabs[cfg.metroStopSlabs.length - 1])?.fare ?? 0;
  }
  const slab =
    cfg.metroSlabs.find((s) => distanceKm <= s.upToKm) ?? cfg.metroSlabs[cfg.metroSlabs.length - 1];
  return slab?.fare ?? 0;
}

export function busFare(distanceKm: number, cfg = fareConfig.bus): number {
  return Math.max(1, Math.ceil(distanceKm / cfg.stageKm)) * cfg.perStage;
}

export interface TransitFareLeg {
  mode: 'metro' | 'train' | 'bus';
  distanceKm: number;
  stops?: number;
}

/** Fare of one transit leg when Google gives none. Rail lines use the metro slabs. */
export function transitLegFare({ mode, distanceKm, stops }: TransitFareLeg): number {
  return mode === 'bus' ? busFare(distanceKm) : metroFare(distanceKm, stops);
}

/**
 * Google's fare is trusted only for bus-only routes it returned unchanged; for
 * metro (Google gives `{}` in Pune) or mixed / edited routes, every transit
 * leg is costed from the slabs.
 */
export function transitRouteFare(
  legs: TransitFareLeg[],
  googleFareInr: number | null,
  unchanged: boolean,
): number {
  const busOnly = legs.length > 0 && legs.every((l) => l.mode === 'bus');
  if (googleFareInr !== null && busOnly && unchanged) return googleFareInr;
  return legs.reduce((sum, l) => sum + transitLegFare(l), 0);
}
