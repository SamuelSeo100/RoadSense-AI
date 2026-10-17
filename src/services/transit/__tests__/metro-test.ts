import { describe, expect, it } from '@jest/globals';

import { metroInService, metroJourneyFare, metroRide, nextMetroDeparture } from '../metro';
import { metroNetwork, slabFare } from '../network';
import { parseHHMM } from '../time';

import { line, metroFixture, n, stations } from '../__fixtures__/networks';

const t = (s: string) => parseHHMM(s)!;

describe('nextMetroDeparture', () => {
  const a = line('lineA', stations('a', ['A1', 'A2', 'A3', 'A4', 'A5']));

  it('adds the run + dwell offset and waits for the next headway', () => {
    // A3 forward: 2 + 0.5 (A2 dwell) + 2 = 4.5 arrive, 5.0 depart after the terminal.
    const dep = nextMetroDeparture(a, 'a-a3', 'forward', t('06:01'));
    expect(dep).toEqual({ departure: t('06:05'), waitMin: 4, terminalDeparture: t('06:00') });
    // Just missed it: next train 10 min later.
    expect(nextMetroDeparture(a, 'a-a3', 'forward', t('06:05') + 0.01)?.departure).toBe(t('06:15'));
  });

  it('uses the headway of the current band', () => {
    // 08:00 onwards every 5 min.
    expect(nextMetroDeparture(a, 'a-a1', 'forward', t('08:01'))?.departure).toBe(t('08:05'));
    expect(nextMetroDeparture(a, 'a-a1', 'forward', t('07:41'))?.departure).toBe(t('07:50'));
  });

  it('times the reverse direction from the other terminal', () => {
    // A4 reverse = 1 segment from A5, no intermediate dwell: departs 2.5 min after.
    expect(nextMetroDeparture(a, 'a-a4', 'reverse', t('06:00'))?.departure).toBe(t('06:00') + 2.5);
  });

  it('waits for the first train before service starts', () => {
    expect(nextMetroDeparture(a, 'a-a1', 'forward', t('05:30'))).toMatchObject({
      departure: t('06:00'),
      waitMin: 30,
    });
  });

  it('returns nothing after the last train', () => {
    expect(nextMetroDeparture(a, 'a-a1', 'forward', t('09:00'))?.departure).toBe(t('09:00'));
    expect(nextMetroDeparture(a, 'a-a1', 'forward', t('09:01'))).toBeNull();
    // The 09:00 train still reaches A3 at 09:05.
    expect(nextMetroDeparture(a, 'a-a3', 'forward', t('09:04'))?.departure).toBe(t('09:05'));
    expect(nextMetroDeparture(a, 'a-a3', 'forward', t('09:06'))).toBeNull();
  });

  it('does not board at the end terminal, closed stations or inactive lines', () => {
    expect(nextMetroDeparture(a, 'a-a5', 'forward', t('07:00'))).toBeNull();
    const closed = line(
      'c',
      stations('c', ['C1', 'C2', 'C3']).map((s, i) => (i === 1 ? { ...s, open: false } : s)),
    );
    expect(nextMetroDeparture(closed, 'c-c2', 'forward', t('07:00'))).toBeNull();
    expect(
      nextMetroDeparture(line('x', a.stations, { active: false }), 'a-a1', 'forward', t('07:00')),
    ).toBeNull();
  });

  it('returns nothing when a required value is unknown', () => {
    const unknown = line('u', a.stations, { dwellSeconds: n<number>(null) });
    expect(nextMetroDeparture(unknown, 'a-a1', 'forward', t('07:00'))).toBeNull();
  });
});

describe('metroRide', () => {
  const net = metroFixture();

  it('rides one line', () => {
    const ride = metroRide('a-a1', 'a-a4', t('06:01'), net)!;
    expect(ride.legs).toHaveLength(1);
    expect(ride.waitMin).toBe(9); // 06:10 train
    // 3 segments + 2 intermediate dwells.
    expect(ride.rideMin).toBe(7);
    expect(ride.transferMin).toBe(0);
    expect(ride.fare).toEqual({ fare: 10, verified: false }); // 3 stations
  });

  it('changes lines at an interchange', () => {
    // A1 → A3 (2 stations), walk 4, B2 → B4 (2 stations).
    const ride = metroRide('a-a1', 'b-b4', t('06:00'), net)!;
    expect(ride.legs.map((l) => l.line.id)).toEqual(['lineA', 'lineB']);
    const [first, second] = ride.legs;
    expect(first!.arrival).toBe(t('06:00') + 4.5);
    // Reach B2 at 06:08.5; B2 forward offset 2.5 → trains at 06:02.5, 06:12.5.
    expect(second!.departure).toBe(t('06:12') + 0.5);
    expect(ride.interchangeWalkMin).toBe(4);
    expect(ride.transferMin).toBeCloseTo(8, 5); // walk 4 + wait 4
    // One journey fare over 4 stations travelled.
    expect(ride.fare).toEqual({ fare: 15, verified: true });
  });

  it('charges per line when the table says so', () => {
    const perLine = metroFixture({ interchange: 'per_line' });
    expect(metroRide('a-a1', 'b-b4', t('06:00'), perLine)?.fare?.fare).toBe(20);
  });

  it('returns nothing when the second train has stopped', () => {
    expect(metroRide('a-a1', 'b-b4', t('08:59'), net)).toBeNull();
  });
});

describe('fare slabs', () => {
  const slabs = [
    { upTo: 3, fare: n(10) },
    { upTo: 6, fare: n<number>(null) },
    { upTo: null, fare: n(30, true) },
  ];

  it('picks the first slab that covers the amount', () => {
    expect(slabFare(slabs, 1)).toEqual({ fare: 10, verified: false });
    expect(slabFare(slabs, 3)).toEqual({ fare: 10, verified: false });
    expect(slabFare(slabs, 99)).toEqual({ fare: 30, verified: true });
  });

  it('is unknown when the slab fare is a TODO', () => {
    expect(slabFare(slabs, 4)).toBeNull();
  });

  it('costs km-based tables by straight-line distance', () => {
    const net = metroFixture({ basis: 'km' });
    const [a] = net.lines;
    // ~1.05 km per segment × 3.
    expect(metroJourneyFare([{ line: a!, stations: 3, km: 3.2 }], net)?.fare).toBe(15);
  });
});

describe('bundled Pune Metro data', () => {
  const at8 = t('08:00');

  it('matches the two published fares used for calibration', () => {
    expect(metroRide('line1-civil-court', 'line1-pcmc', at8)?.fare?.fare).toBe(20);
    expect(metroRide('line2-vanaz', 'line2-ruby-hall-clinic', at8)?.fare?.fare).toBe(25);
  });

  it('counts 12 stops PCMC → Swargate, as Google does (Range Hill not open)', () => {
    expect(metroRide('line1-pcmc', 'line1-swargate', at8)?.legs[0]?.stations).toBe(12);
  });

  it('routes Vanaz → PCMC through Civil Court', () => {
    const ride = metroRide('line2-vanaz', 'line1-pcmc', at8);
    expect(ride?.legs.map((l) => l.line.id)).toEqual(['line2', 'line1']);
  });

  it('has no metro at 23:45 and keeps Line 3 off until confirmed', () => {
    expect(metroRide('line1-pcmc', 'line1-swargate', t('23:45'))).toBeNull();
    expect(metroInService(t('23:45'))).toBe(false);
    expect(metroInService(at8)).toBe(true);
    expect(metroNetwork.lines.find((l) => l.id === 'line3')?.active).toBe(false);
  });
});
