import { describe, expect, it, jest } from '@jest/globals';

import {
  busLegKey,
  busLegOf,
  createBusEtaService,
  estimateBusLeg,
  hourBand,
  type BusLeg,
  type FetchTrafficRatio,
} from '../busEta';
import type { Leg } from '../types';

/** IST wall-clock time on 2026-10-22 as a Date. */
const ist = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 22, hh, mm) - 5.5 * 60 * 60 * 1000);

const leg = (dep: Date, rideMin: number): BusLeg => ({
  line: '21',
  fromStop: 'Natraj',
  toStop: 'Baner Road National Society Samor',
  from: { latitude: 18.500485, longitude: 73.857857 },
  to: { latitude: 18.549385, longitude: 73.811161 },
  departureAt: dep.toISOString(),
  arrivalAt: new Date(dep.getTime() + rideMin * 60_000).toISOString(),
});

describe('hourBand (IST)', () => {
  it.each([
    [8, 'peak'],
    [10, 'peak'],
    [11, 'off_peak'],
    [16, 'off_peak'],
    [17, 'peak'],
    [20, 'peak'],
    [21, 'night'],
    [2, 'night'],
    [5, 'night'],
    [6, 'off_peak'],
  ])('%i:00 → %s', (hh, band) => {
    expect(hourBand(ist(hh))).toBe(band);
  });
});

describe('estimateBusLeg', () => {
  it('schedule only: ride = scheduled, range from the band margin', () => {
    const eta = estimateBusLeg(leg(ist(9), 30), null);
    expect(eta.source).toBe('scheduled');
    expect(eta.trafficFactor).toBeNull();
    expect(eta.rideLowMin).toBe(30);
    expect(eta.rideHighMin).toBeCloseTo(40.5); // peak: × 1.35
  });

  it('with traffic: ride × factor, clamped to [1, 2.5]', () => {
    expect(estimateBusLeg(leg(ist(14), 20), 1.5).rideLowMin).toBe(30);
    expect(estimateBusLeg(leg(ist(14), 20), 1.5).rideHighMin).toBeCloseTo(36); // off-peak
    expect(estimateBusLeg(leg(ist(14), 20), 0.8).trafficFactor).toBe(1);
    expect(estimateBusLeg(leg(ist(14), 20), 4).trafficFactor).toBe(2.5);
    expect(estimateBusLeg(leg(ist(23), 20), 1).rideHighMin).toBeCloseTo(23); // night
  });

  it('arrival at the stop: scheduled → + late window', () => {
    const dep = ist(18);
    const eta = estimateBusLeg(leg(dep, 30), 1.2);
    expect(eta.departLowAt).toBe(dep.getTime());
    expect(eta.departHighAt).toBe(dep.getTime() + 5 * 60_000);
  });
});

describe('busLegOf', () => {
  const base: Leg = {
    mode: 'bus',
    label: 'Bus 21',
    durationMin: 30,
    from: 'Natraj',
    to: 'Baner',
    departureAt: '2026-10-22T14:20:47Z',
    arrivalAt: '2026-10-22T14:50:14Z',
    fromLocation: { latitude: 18.5, longitude: 73.85 },
    toLocation: { latitude: 18.55, longitude: 73.81 },
    lineShortName: '21',
  };

  it('needs a bus with stop coordinates and valid scheduled times', () => {
    expect(busLegOf(base)?.line).toBe('21');
    expect(busLegOf({ ...base, mode: 'metro' })).toBeNull();
    expect(busLegOf({ ...base, toLocation: undefined })).toBeNull();
    expect(busLegOf({ ...base, arrivalAt: base.departureAt })).toBeNull();
    expect(busLegOf({ ...base, lineShortName: undefined })?.line).toBeNull();
  });
});

describe('createBusEtaService', () => {
  it('one call per stop pair and 15-min bucket, in flight or cached', async () => {
    const fetchRatio = jest.fn(async () => 1.4);
    const service = createBusEtaService(fetchRatio);
    const a = leg(ist(9, 1), 30);
    const sameBucket = leg(ist(9, 10), 30);
    const [f1, f2] = await Promise.all([service.trafficFactor(a), service.trafficFactor(a)]);
    expect(await service.trafficFactor(sameBucket)).toBe(1.4);
    expect([f1, f2]).toEqual([1.4, 1.4]);
    expect(fetchRatio).toHaveBeenCalledTimes(1);
    await service.trafficFactor(leg(ist(9, 20), 30));
    expect(fetchRatio).toHaveBeenCalledTimes(2);
    expect(busLegKey(a)).not.toBe(busLegKey(sameBucket));
  });

  it('a failed or empty call gives null (schedule only) and is retried later', async () => {
    const fetchRatio = jest
      .fn<FetchTrafficRatio>()
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1.1);
    const service = createBusEtaService(fetchRatio);
    const a = leg(ist(15), 20);
    expect(await service.trafficFactor(a)).toBeNull();
    expect(await service.trafficFactor(a)).toBeNull();
    expect(await service.trafficFactor(a)).toBe(1.1);
  });

  it('no Google key: never calls, schedule only', async () => {
    expect(await createBusEtaService(null).trafficFactor(leg(ist(9), 30))).toBeNull();
  });
});
