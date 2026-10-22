import { describe, expect, it } from '@jest/globals';

import { routeCost, shortLegLabel } from '@/components/routly/routeFormat';

import {
  costNoteFor,
  energyPrices,
  fuelsFor,
  mileageWarning,
  ownVehicleProfiles,
  tripEnergyCost,
  unitFor,
  type FuelType,
  type UserVehicle,
  type VehicleType,
} from '../vehicles';

const vehicle = (over: Partial<UserVehicle>): UserVehicle => ({
  id: 'v',
  type: 'scooter',
  nickname: null,
  fuelType: 'petrol',
  efficiency: 45,
  efficiencyUnit: 'km_per_l',
  priceOverride: null,
  isDefault: true,
  ...over,
});

describe('trip cost = distance / efficiency × price', () => {
  it('petrol scooty, 45 km/L, 18 km', () => {
    expect(tripEnergyCost(18, vehicle({}))).toBe(Math.round((18 / 45) * energyPrices.petrol));
  });
  it('EV car per kWh, price override wins', () => {
    const ev = vehicle({
      type: 'car',
      fuelType: 'electric',
      efficiency: 6.5,
      efficiencyUnit: 'km_per_kwh',
    });
    expect(tripEnergyCost(26, ev)).toBe(Math.round((26 / 6.5) * energyPrices.electric));
    expect(tripEnergyCost(26, { ...ev, priceOverride: 20 })).toBe(80);
  });
  it('CNG per kg', () => {
    const cng = vehicle({
      type: 'car',
      fuelType: 'cng',
      efficiency: 25,
      efficiencyUnit: 'km_per_kg',
    });
    expect(tripEnergyCost(50, cng)).toBe(Math.round(2 * energyPrices.cng));
  });
});

describe('units and fuels', () => {
  it('unit follows the fuel', () => {
    expect(unitFor('petrol')).toBe('km_per_l');
    expect(unitFor('diesel')).toBe('km_per_l');
    expect(unitFor('cng')).toBe('km_per_kg');
    expect(unitFor('electric')).toBe('km_per_kwh');
  });
  it('no CNG scooty', () => {
    expect(fuelsFor('scooter')).not.toContain('cng');
    expect(fuelsFor('car')).toContain('cng');
  });
  it('"charge" for EVs, "fuel" otherwise', () => {
    expect(costNoteFor('electric')).toBe('charge');
    expect(costNoteFor('cng')).toBe('fuel');
  });
});

describe('mileage validation (warn, never block)', () => {
  const cases: [VehicleType, FuelType, number, boolean][] = [
    ['car', 'petrol', 8, false],
    ['car', 'petrol', 40, true],
    ['scooter', 'petrol', 45, false],
    ['scooter', 'petrol', 20, true],
    ['car', 'cng', 36, true],
    ['car', 'electric', 6, false],
    ['car', 'electric', 12, true],
    ['scooter', 'electric', 15, false],
    ['scooter', 'electric', 55, true],
  ];
  it.each(cases)('%s %s %d km → warn %s', (type, fuel, km, warns) => {
    expect(mileageWarning(type, fuel, km) !== null).toBe(warns);
  });
  it('rejects zero / not a number', () => {
    expect(mileageWarning('car', 'petrol', 0)).not.toBeNull();
    expect(mileageWarning('car', 'petrol', Number.NaN)).not.toBeNull();
  });
});

describe('labels', () => {
  it('only a scooty → "Your scooty" on the bike route; a car → "Your car"; nickname wins', () => {
    expect(ownVehicleProfiles([vehicle({})])).toEqual({
      bike: expect.objectContaining({ label: 'Your scooty', costNote: 'fuel' }),
    });
    const car = vehicle({
      type: 'car',
      fuelType: 'electric',
      efficiency: 6,
      efficiencyUnit: 'km_per_kwh',
    });
    expect(ownVehicleProfiles([car])).toEqual({
      car: expect.objectContaining({ label: 'Your car', costNote: 'charge' }),
    });
    expect(ownVehicleProfiles([vehicle({ nickname: 'Activa' })]).bike?.label).toBe('Activa');
    expect(ownVehicleProfiles([])).toEqual({});
  });
  it('route card: "₹X fuel" / "₹X charge", and the vehicle name in the leg pill', () => {
    expect(routeCost({ costInr: 45, costNote: 'fuel', legs: [] })).toBe('₹45 fuel');
    expect(routeCost({ costInr: 48, costNote: 'charge', legs: [] })).toBe('₹48 charge');
    expect(routeCost({ costInr: 45, legs: [] })).toBe('₹45');
    const leg = (label: string) => ({ mode: 'bike' as const, label, durationMin: 31 });
    expect(shortLegLabel(leg('Your scooty 31m'))).toBe('Your scooty 31m');
    expect(shortLegLabel(leg('Bike 31m'))).toBe('Bike 31m');
    expect(shortLegLabel({ mode: 'auto', label: 'Auto to Swargate', durationMin: 9 })).toBe(
      'Auto 9m',
    );
  });
});
