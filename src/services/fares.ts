/**
 * Fare estimates for Pune, in ₹. Pure functions over one config object.
 *
 * VERIFY: every rate below must be checked against the current Pune RTO
 * (auto / cab) notification, Maha-Metro's Pune fare table and PMPML's stage
 * fare chart before release. Fuel costs follow the Pune petrol price.
 */
export const fareConfig = {
  auto: {
    /** Meter minimum, covers the first `baseKm`. */
    baseFare: 26,
    baseKm: 1.5,
    perKm: 17,
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
  /** Maha-Metro Pune: fare by distance travelled (upper bound km → ₹). */
  metroSlabs: [
    { upToKm: 2, fare: 10 },
    { upToKm: 4, fare: 15 },
    { upToKm: 8, fare: 20 },
    { upToKm: 12, fare: 25 },
    { upToKm: 18, fare: 30 },
    { upToKm: Infinity, fare: 35 },
  ],
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

export function metroFare(distanceKm: number, slabs = fareConfig.metroSlabs): number {
  const slab = slabs.find((s) => distanceKm <= s.upToKm) ?? slabs[slabs.length - 1];
  return slab?.fare ?? 0;
}

export function busFare(distanceKm: number, cfg = fareConfig.bus): number {
  return Math.max(1, Math.ceil(distanceKm / cfg.stageKm)) * cfg.perStage;
}

/** Fare of one transit leg when Google gives none. Rail lines use the metro slabs. */
export function transitLegFare(mode: 'metro' | 'train' | 'bus', distanceKm: number): number {
  return mode === 'bus' ? busFare(distanceKm) : metroFare(distanceKm);
}

/**
 * Google's fare is trusted only for bus-only routes it returned unchanged; for
 * metro (Google gives `{}` in Pune) or mixed / edited routes, every transit
 * leg is costed from the slabs.
 */
export function transitRouteFare(
  legs: { mode: 'metro' | 'train' | 'bus'; distanceKm: number }[],
  googleFareInr: number | null,
  unchanged: boolean,
): number {
  const busOnly = legs.length > 0 && legs.every((l) => l.mode === 'bus');
  if (googleFareInr !== null && busOnly && unchanged) return googleFareInr;
  return legs.reduce((sum, l) => sum + transitLegFare(l.mode, l.distanceKm), 0);
}
