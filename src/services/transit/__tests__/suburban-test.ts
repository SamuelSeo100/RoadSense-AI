import { describe, expect, it } from '@jest/globals';

import { nextSuburbanDeparture } from '../suburban';
import { parseHHMM } from '../time';

import { suburbanFixture, trip } from '../__fixtures__/networks';

const t = (s: string) => parseHHMM(s)!;
const SUN = 0;
const MON = 1;
const SAT = 6;

describe('nextSuburbanDeparture', () => {
  const net = suburbanFixture([
    trip('U1', ['05:00', '05:08', '05:15', '05:22', '05:30']),
    trip('U2', ['06:00', '-', '06:14', '06:21', '06:29']),
    trip('D1', ['07:30', '07:22', '07:15', '07:08', '07:00'], undefined, 'DOWN'),
    trip('WEEKDAY', ['09:00', '09:08', '09:15', '09:22', '09:30'], [1, 2, 3, 4, 5, 6]),
    // Saturday's late train runs past midnight (hours ≥ 24).
    trip('LATE', ['23:30', '23:38', '23:45', '24:05', '24:15'], [SAT]),
    // A Sunday early train.
    trip('SUNEARLY', ['00:20', '00:28', '00:35', '00:42', '00:50'], [SUN]),
  ]);
  const next = (a: string, b: string, time: string, day: number, maxWaitMin?: number) =>
    nextSuburbanDeparture(`s-${a}`, `s-${b}`, t(time), day, { maxWaitMin }, net);

  it('finds the next trip that stops at both stations', () => {
    expect(next('s0', 's4', '04:50', MON)).toMatchObject({
      trainNo: 'U1',
      departure: t('05:00'),
      arrival: t('05:30'),
      waitMin: 10,
      rideMin: 30,
    });
    // U2 skips S1.
    expect(next('s1', 's3', '05:09', MON)?.trainNo).toBe('WEEKDAY');
  });

  it('only uses trips going the right way', () => {
    expect(next('s4', 's0', '06:30', MON)).toMatchObject({ trainNo: 'D1', direction: 'DOWN' });
    expect(next('s0', 's4', '06:30', MON)?.trainNo).toBe('WEEKDAY');
  });

  it('respects days of operation', () => {
    expect(next('s0', 's4', '08:00', MON)?.trainNo).toBe('WEEKDAY');
    expect(next('s0', 's4', '08:00', SAT)?.trainNo).toBe('WEEKDAY');
    // Sunday: no weekday train, so the next is Monday's first (tomorrow, 1440 + 05:00).
    expect(next('s0', 's4', '08:00', SUN)).toMatchObject({ trainNo: 'U1', departure: 1440 + 300 });
  });

  it('catches a train that left yesterday and is still running after midnight', () => {
    // Sunday 00:00 at S3: Saturday's LATE leaves S3 at 24:05 = Sunday 00:05.
    expect(next('s3', 's4', '00:00', SUN)).toMatchObject({
      trainNo: 'LATE',
      departure: 5,
      arrival: 15,
    });
  });

  it('crosses into tomorrow for a train just after midnight', () => {
    // Saturday 23:55: Sunday's 00:20 is tomorrow (1440 + 20), sooner than anything else.
    expect(next('s0', 's1', '23:55', SAT)).toMatchObject({
      trainNo: 'SUNEARLY',
      departure: 1440 + 20,
      waitMin: 25,
    });
    // Friday 23:55: SUNEARLY doesn't run on Saturday.
    expect(next('s0', 's1', '23:55', 5)?.trainNo).not.toBe('SUNEARLY');
  });

  it('gives nothing outside service hours (wait cap)', () => {
    expect(next('s0', 's4', '10:00', MON, 45)).toBeNull();
    expect(next('s0', 's4', '22:50', SAT, 45)?.trainNo).toBe('LATE');
  });

  it('prices by km slab', () => {
    // S0 → S4 = 24 km.
    expect(next('s0', 's4', '04:50', MON)?.fare).toEqual({ fare: 15, verified: false });
    expect(next('s0', 's1', '04:50', MON)?.fare?.fare).toBe(5);
  });

  it('has nothing without trips', () => {
    expect(
      nextSuburbanDeparture('s-s0', 's-s4', t('08:00'), MON, {}, suburbanFixture([])),
    ).toBeNull();
  });
});
