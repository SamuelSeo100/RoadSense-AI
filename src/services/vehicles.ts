/**
 * The user's own car / scooty: trip cost from their real mileage instead of the
 * generic fares.ts estimate, and the route label ("Your scooty").
 */

export type VehicleType = 'car' | 'scooter';
export type FuelType = 'petrol' | 'diesel' | 'cng' | 'electric';
export type EfficiencyUnit = 'km_per_l' | 'km_per_kg' | 'km_per_kwh';

export interface UserVehicle {
  id: string;
  type: VehicleType;
  nickname: string | null;
  fuelType: FuelType;
  /** Distance per unit of energy, in `efficiencyUnit`. */
  efficiency: number;
  efficiencyUnit: EfficiencyUnit;
  /** ₹ per unit of energy, overriding `energyPrices` (null = the Pune default). */
  priceOverride: number | null;
  isDefault: boolean;
}

/**
 * Pune retail prices, ₹ per litre / kg / kWh.
 * - petrol 111.90, diesel 98.55: goodreturns.in/petrol-price-in-pune.html and
 *   /diesel-price-in-pune.html, both dated 22 Oct 2026 (aggregator).
 * - CNG 97.75: mngl.in homepage ticker (MNGL supplies Pune), read 22 Oct 2026 but the
 *   ticker shows no date; goodreturns.in/cng-price-in-pune.html showed 100.50 the same day.
 * - electricity 12: UNVERIFIED placeholder (no MSEDCL residential tariff found on
 *   mahadiscom.in on 22 Oct 2026). Users can override it per vehicle.
 */
export const energyPrices: Record<FuelType, number> = {
  petrol: 111.9,
  diesel: 98.55,
  cng: 97.75,
  electric: 12,
};

export const unitFor = (fuel: FuelType): EfficiencyUnit =>
  fuel === 'cng' ? 'km_per_kg' : fuel === 'electric' ? 'km_per_kwh' : 'km_per_l';

export const unitLabel: Record<EfficiencyUnit, string> = {
  km_per_l: 'km/L',
  km_per_kg: 'km/kg',
  km_per_kwh: 'km/kWh',
};

export const priceUnitLabel: Record<EfficiencyUnit, string> = {
  km_per_l: '₹/L',
  km_per_kg: '₹/kg',
  km_per_kwh: '₹/kWh',
};

/** Fuels a vehicle type can use (no CNG scooters). */
export const fuelsFor = (type: VehicleType): FuelType[] =>
  type === 'car' ? ['petrol', 'diesel', 'cng', 'electric'] : ['petrol', 'electric'];

/** Plausible mileage per type and fuel: outside it, warn (saving is still allowed). */
const ranges: Record<VehicleType, Partial<Record<FuelType, [number, number]>>> = {
  car: { petrol: [8, 35], diesel: [8, 35], cng: [10, 35], electric: [4, 10] },
  scooter: { petrol: [25, 90], electric: [15, 50] },
};

/** A warning for an unusual mileage, or null when it looks right. */
export function mileageWarning(
  type: VehicleType,
  fuel: FuelType,
  efficiency: number,
): string | null {
  if (!Number.isFinite(efficiency) || efficiency <= 0) return 'Enter a mileage above 0.';
  const range = ranges[type][fuel];
  if (!range) return null;
  const [lo, hi] = range;
  if (efficiency >= lo && efficiency <= hi) return null;
  return `That's unusual for this vehicle (typical ${lo}–${hi} ${unitLabel[unitFor(fuel)]}). Check it, or save anyway.`;
}

/** ₹ per km for the vehicle. */
export const costPerKm = (v: Pick<UserVehicle, 'fuelType' | 'efficiency' | 'priceOverride'>) =>
  (v.priceOverride ?? energyPrices[v.fuelType]) / v.efficiency;

/** distance / efficiency × price, rounded to the rupee. */
export const tripEnergyCost = (
  distanceKm: number,
  v: Pick<UserVehicle, 'fuelType' | 'efficiency' | 'priceOverride'>,
) => Math.round(distanceKm * costPerKm(v));

/** "fuel" or "charge" (EV) after the price on the route card. */
export const costNoteFor = (fuel: FuelType): 'fuel' | 'charge' =>
  fuel === 'electric' ? 'charge' : 'fuel';

/** What routing needs to cost and name an own-vehicle route. */
export interface OwnVehicleProfile {
  perKmInr: number;
  costNote: 'fuel' | 'charge';
  /** "Your scooty", "Your car" or the nickname. */
  label: string;
}

/** Car → DRIVE ("car" route), scooter → TWO_WHEELER ("bike" route). */
export function ownVehicleProfiles(
  vehicles: readonly UserVehicle[],
): Partial<Record<'car' | 'bike', OwnVehicleProfile>> {
  const pick = (type: VehicleType) =>
    vehicles.find((v) => v.type === type && v.isDefault) ?? vehicles.find((v) => v.type === type);
  const profile = (v: UserVehicle | undefined): OwnVehicleProfile | undefined =>
    v && {
      perKmInr: costPerKm(v),
      costNote: costNoteFor(v.fuelType),
      label: v.nickname?.trim() || (v.type === 'car' ? 'Your car' : 'Your scooty'),
    };
  const out: Partial<Record<'car' | 'bike', OwnVehicleProfile>> = {};
  const car = profile(pick('car'));
  const bike = profile(pick('scooter'));
  if (car) out.car = car;
  if (bike) out.bike = bike;
  return out;
}

/** Cache key part: routes are re-costed when a vehicle changes. */
export const profilesKey = (p: Partial<Record<'car' | 'bike', OwnVehicleProfile>>) =>
  (['car', 'bike'] as const)
    .map((k) => (p[k] ? `${k}:${p[k]!.perKmInr.toFixed(3)}:${p[k]!.costNote}:${p[k]!.label}` : ''))
    .join('|');
