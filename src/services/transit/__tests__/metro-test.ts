import { describe, expect, it } from '@jest/globals';

import { line, metroFixture, n } from '../__fixtures__/networks';
import { metroInService, metroRide, nextMetroDeparture } from '../metro';
import { metroFare, metroNetwork } from '../network';
import { parseHHMM } from '../time';

const t = (s: string) => parseHHMM(s)!;

describe('nextMetroDeparture (headway / 2)', () => {
  const a = line('lineA', ['A1', 'A2', 'X', 'A4', 'A5']);

  it('waits half the headway in service', () => {
    // Off-peak 20 min → 10 min wait; peak 10 min → 5 min.
    expect(nextMetroDeparture(a, 'A1', 'forward', t('06:30'))).toEqual({
      departure: t('06:40'),
      waitMin: 10,
      headwayMin: 20,
    });
    expect(nextMetroDeparture(a, 'A1', 'forward', t('08:10'))?.waitMin).toBe(5);
  });

  it('waits for the first train to reach the station', () => {
    // X forward: 2 + 0.5 + 2 = 4.5 arrive, +0.5 dwell → first train leaves 06:05.
    expect(nextMetroDeparture(a, 'X', 'forward', t('06:01'))).toMatchObject({
      departure: t('06:05'),
      waitMin: 4,
    });
    // Reverse from A5: A4 is one segment away (06:02.5).
    expect(nextMetroDeparture(a, 'A4', 'reverse', t('06:00'))?.departure).toBe(t('06:02') + 0.5);
  });

  it('stops after the last train has passed', () => {
    expect(nextMetroDeparture(a, 'A1', 'forward', t('09:00'))?.departure).toBe(t('09:00'));
    expect(nextMetroDeparture(a, 'A1', 'forward', t('09:01'))).toBeNull();
    // The 09:00 train leaves X at 09:05: the wait is capped by it, then nothing.
    expect(nextMetroDeparture(a, 'X', 'forward', t('09:04'))).toMatchObject({
      departure: t('09:05'),
      waitMin: 1,
    });
    expect(nextMetroDeparture(a, 'X', 'forward', t('09:06'))).toBeNull();
  });

  it('does not board at the end terminal, on inactive lines or with unknown timings', () => {
    expect(nextMetroDeparture(a, 'A5', 'forward', t('07:00'))).toBeNull();
    expect(nextMetroDeparture({ ...a, active: false }, 'A1', 'forward', t('07:00'))).toBeNull();
    const unknown = line('u', a.stations, { dwellSeconds: n<number>(null) });
    expect(nextMetroDeparture(unknown, 'A1', 'forward', t('07:00'))).toBeNull();
  });
});

describe('metroRide', () => {
  const net = metroFixture();

  it('rides one line, fare from the matrix', () => {
    const ride = metroRide('A1', 'A4', t('06:30'), net)!;
    expect(ride.legs).toHaveLength(1);
    expect(ride.waitMin).toBe(10);
    expect(ride.rideMin).toBe(7); // 3 segments + 2 dwells
    expect(ride.legs[0]!.stations).toBe(3);
    expect(ride.fare).toEqual({ fare: 10, verified: true });
  });

  it('changes lines at the interchange', () => {
    const ride = metroRide('A1', 'B4', t('06:30'), net)!;
    expect(ride.legs.map((l) => [l.line.id, l.from, l.to])).toEqual([
      ['lineA', 'A1', 'X'],
      ['lineB', 'X', 'B4'],
    ]);
    // A1 06:40 → X 06:44.5, walk 4, wait 10 → 06:58.5, arrive B4 07:03.
    expect(ride.legs[1]!.departure).toBe(t('06:58') + 0.5);
    expect(ride.arrival).toBe(t('07:03'));
    expect(ride.interchangeWalkMin).toBe(4);
    expect(ride.transferMin).toBeCloseTo(14, 5);
    // One fare for the whole journey.
    expect(ride.fare?.fare).toBe(25);
  });

  it('rides directly to or from the interchange station', () => {
    expect(metroRide('X', 'B4', t('06:30'), net)?.legs).toHaveLength(1);
    expect(metroRide('A1', 'X', t('06:30'), net)?.legs).toHaveLength(1);
  });

  it('returns nothing once the second line has stopped', () => {
    expect(metroRide('A1', 'B4', t('08:59'), net)).toBeNull();
  });
});

describe('bundled Pune Metro data', () => {
  it('reads fares from the official matrix (Phugewadi ↔ Swargate ₹30 both ways)', () => {
    expect(metroFare('PGD', 'SGT')).toEqual({ fare: 30, verified: true });
    expect(metroFare('SGT', 'PGD')).toEqual({ fare: 30, verified: true });
    expect(metroRide('PGD', 'SGT', t('12:00'))?.fare?.fare).toBe(30);
    expect(metroRide('SGT', 'PGD', t('12:00'))?.fare?.fare).toBe(30);
  });

  it('has a full symmetric 28 × 28 matrix', () => {
    const codes = metroNetwork.stations.map((s) => s.code);
    expect(codes).toHaveLength(28);
    for (const a of codes) {
      for (const b of codes) expect(metroFare(a, b)?.fare).toBe(metroFare(b, a)?.fare);
    }
  });

  it('uses half the headway: 5 min at peak, 7.5 off-peak', () => {
    const purple = metroNetwork.lines.find((l) => l.id === 'purple')!;
    expect(nextMetroDeparture(purple, 'PIM', 'forward', t('09:00'))?.waitMin).toBe(5);
    expect(nextMetroDeparture(purple, 'PIM', 'forward', t('12:00'))?.waitMin).toBe(7.5);
  });

  it('routes Vanaz → PCMC through District Court (CVC)', () => {
    const ride = metroRide('VNZ', 'PIM', t('08:30'));
    expect(ride?.legs.map((l) => `${l.line.id}:${l.from}>${l.to}`)).toEqual([
      'aqua:VNZ>CVC',
      'purple:CVC>PIM',
    ]);
    expect(ride?.fare?.fare).toBe(metroFare('VNZ', 'PIM')?.fare);
  });

  it('runs until the 23:00 last train', () => {
    expect(metroRide('PIM', 'SGT', t('22:30'))).not.toBeNull();
    expect(metroRide('PIM', 'SGT', t('23:01'))).toBeNull();
    expect(metroInService(t('22:30'))).toBe(true);
    expect(metroInService(t('23:30'))).toBe(false);
  });

  it('rides end to end in Google Transit time (34 / 36 min, calibrated)', () => {
    expect(metroRide('PIM', 'SGT', t('12:00'))?.rideMin).toBeCloseTo(34, 1);
    expect(metroRide('VNZ', 'RAW', t('12:00'))?.rideMin).toBeCloseTo(36, 1);
    const seg = metroNetwork.lines[0]!.segmentMinutes[0]!;
    expect(seg).toMatchObject({ estimated: true, calibratedTo: 'google-transit-2026-10-19' });
  });

  it('keeps Line 3 off until it is confirmed', () => {
    expect(metroNetwork.lines.find((l) => l.id === 'line3')?.active).toBe(false);
  });
});
