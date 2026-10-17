import type { MetroLine, MetroNetwork, MetroStation, Sourced } from '../types';

export const n = <T>(value: T | null, verified = false): Sourced<T> => ({
  value,
  verified,
  source: 'test fixture',
});

const station = (code: string, lat: number, lng: number): MetroStation => ({
  code,
  name: `Station ${code}`,
  lat,
  lng,
  geocoded: true,
});

/**
 * 2 min per segment, 30 s dwell, 06:00–09:00; every 10 min 08:00–09:00
 * (peak), every 20 min otherwise.
 */
export function line(id: string, stations: string[], over: Partial<MetroLine> = {}): MetroLine {
  return {
    id,
    name: `${id} Line`,
    color: '#123456',
    active: true,
    stations,
    segmentMinutes: stations.slice(1).map(() => n(2)),
    dwellSeconds: n(30),
    firstTrain: n('06:00'),
    lastTrain: n('09:00'),
    headways: [{ band: 'peak', from: '08:00', to: '09:00', headwayMin: n(10) }],
    offPeakHeadwayMin: n(20),
    ...over,
  };
}

/**
 * Line A (A1, A2, X, A4, A5, east–west, ~1 km apart) and line B (B1, X, B3,
 * B4, north–south) sharing the interchange X. Fares: ₹10 per pair plus ₹5
 * per letter group crossed (A↔B = ₹25), from a full symmetric matrix.
 */
export function metroFixture(over: Partial<MetroNetwork> = {}): MetroNetwork {
  const stations = [
    station('A1', 18.5, 73.8),
    station('A2', 18.5, 73.81),
    station('X', 18.5, 73.82),
    station('A4', 18.5, 73.83),
    station('A5', 18.5, 73.84),
    station('B1', 18.51, 73.82),
    station('B3', 18.49, 73.82),
    station('B4', 18.48, 73.82),
  ];
  const codes = stations.map((s) => s.code);
  const group = (c: string) => c[0];
  const matrix = Object.fromEntries(
    codes.map((a) => [
      a,
      Object.fromEntries(codes.map((b) => [b, a === b ? 0 : group(a) === group(b) ? 10 : 25])),
    ]),
  );
  return {
    stations,
    lines: [line('lineA', ['A1', 'A2', 'X', 'A4', 'A5']), line('lineB', ['B1', 'X', 'B3', 'B4'])],
    interchanges: [{ station: 'X', lines: ['lineA', 'lineB'], walkMinutes: n(4) }],
    fares: { source: 'test', checkedOn: 'test', verified: true, matrix, adjusted: [] },
    ...over,
  };
}
