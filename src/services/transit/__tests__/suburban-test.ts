import { describe, expect, it } from '@jest/globals';

import { nextSuburbanDeparture, suburbanFare, tripIssues } from '../suburban';
import { parseHHMM } from '../time';
import type { SuburbanNetwork } from '../types';

/** Against the bundled Pune–Lonavala timetable. */
const t = (s: string) => parseHHMM(s)!;
const next = (from: string, to: string, time: string, maxWaitMin?: number) =>
  nextSuburbanDeparture(from, to, t(time), { maxWaitMin });

describe('nextSuburbanDeparture', () => {
  it('finds the next trip stopping at both stations, in order', () => {
    expect(next('PUNE', 'AKRD', '08:00')).toMatchObject({
      tripId: 'UP-06',
      departure: t('08:05'),
      waitMin: 5,
      direction: 'UP',
    });
    // The other way is a DOWN train.
    expect(next('AKRD', 'PUNE', '09:00')?.direction).toBe('DOWN');
  });

  it('takes the 00:10 local for Pune Jn → Lonavala at 23:55', () => {
    expect(next('PUNE', 'LNL', '23:55')).toMatchObject({
      tripId: 'UP-01',
      label: '1ST LOCAL',
      departure: 1440 + 10,
      waitMin: 15,
      arrival: 1440 + t('01:30'),
    });
  });

  it('follows dayOffset for a train still running after midnight', () => {
    // DOWN-22 leaves Lonavala 23:40 and reaches Akurdi 00:23 (+1).
    expect(next('LNL', 'AKRD', '23:30')).toMatchObject({
      tripId: 'DOWN-22',
      departure: t('23:40'),
      arrival: 1440 + t('00:23'),
      rideMin: 43,
    });
    // Just after midnight: the same train, which started yesterday, from Vadgaon (00:02).
    // (DOWN-01 starts at Talegaon, so it doesn't serve Vadgaon.)
    expect(next('VDN', 'KK', '00:01')).toMatchObject({ tripId: 'DOWN-22', departure: t('00:02') });
  });

  it('skips short workings that do not serve both stations', () => {
    // UP-05 (06:50) ends at Talegaon.
    expect(next('PUNE', 'TGN', '06:45')?.tripId).toBe('UP-05');
    expect(next('PUNE', 'LNL', '06:45')?.tripId).toBe('UP-06');
    // UP-09 (11:20) starts at Shivaji Nagar, not Pune Jn.
    expect(next('SVJR', 'LNL', '11:00')?.tripId).toBe('UP-09');
    expect(next('PUNE', 'KK', '11:00')?.tripId).toBe('UP-10');
    // DOWN-07 ends at Shivaji Nagar.
    expect(next('AKRD', 'SVJR', '10:00')?.tripId).toBe('DOWN-07');
    expect(next('AKRD', 'PUNE', '10:00')?.tripId).not.toBe('DOWN-07');
  });

  it('skips a trip only when its data issue touches the requested stops', () => {
    // UP-17: "KK 19:16 is earlier than previous stop" (SVJR 19:18).
    expect(next('PUNE', 'KK', '19:00')?.tripId).toBe('UP-18');
    expect(next('PUNE', 'LNL', '19:00')?.tripId).toBe('UP-17');
    // DOWN-21: gap before PUNE → its Pune Jn arrival is in doubt, Khadki is not.
    expect(next('LNL', 'PUNE', '22:20')?.tripId).not.toBe('DOWN-21');
    expect(next('LNL', 'KK', '22:20')?.tripId).toBe('DOWN-21');
  });

  it('gives nothing beyond the wait cap', () => {
    expect(next('PUNE', 'LNL', '02:00', 45)).toBeNull();
  });
});

describe('dataIssues', () => {
  it('maps every listed issue to a trip and its stations', () => {
    const { byTrip, unmatched } = tripIssues();
    expect(unmatched).toEqual([]);
    expect([...(byTrip.get('UP-17')!.stations as Set<string>)].sort()).toEqual(['KK', 'SVJR']);
    expect([...(byTrip.get('UP-10')!.stations as Set<string>)].sort()).toEqual(['LNL', 'MVL']);
  });

  it('flags the whole trip when the issue is not understood', () => {
    const net: SuburbanNetwork = {
      line: { id: 'x', name: 'x' },
      source: { name: '', author: '', credit: '' },
      stations: [],
      fare: { slabs: [], verified: false, source: '' },
      trips: [
        {
          id: 'T',
          label: 'Odd',
          direction: 'UP',
          origin: 'A',
          terminus: 'B',
          days: 'TODO_VERIFY',
          trainNo: null,
          stops: [],
        },
      ],
      dataIssues: ['UP Odd: something strange', 'UP Missing: gap before A'],
    };
    const { byTrip, unmatched } = tripIssues(net);
    expect(byTrip.get('T')?.stations).toBe('all');
    expect(unmatched).toEqual(['UP Missing: gap before A']);
  });
});

describe('suburbanFare (provisional slabs)', () => {
  it('prices by |km difference|', () => {
    expect(suburbanFare('PUNE', 'PMP')).toMatchObject({ fare: 5, km: 14.4 });
    expect(suburbanFare('AKRD', 'PUNE')).toMatchObject({ fare: 10, km: 19.9 });
    expect(suburbanFare('PUNE', 'LNL')).toMatchObject({ fare: 15, verified: false });
    expect(suburbanFare('PUNE', 'NOPE')).toBeNull();
  });
});
