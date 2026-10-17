import type {
  MetroLine,
  MetroNetwork,
  Sourced,
  SuburbanNetwork,
  SuburbanTrip,
  TransitStation,
} from '../types';

export const n = <T>(value: T | null, verified = false): Sourced<T> => ({
  value,
  verified,
  source: 'test fixture',
});

/** Stations along a straight east–west line, ~1.05 km apart. */
export function stations(
  prefix: string,
  names: string[],
  lat = 18.5,
  lng0 = 73.8,
): TransitStation[] {
  return names.map((name, i) => ({
    id: `${prefix}-${name.toLowerCase()}`,
    name,
    lat,
    lng: lng0 + i * 0.01,
    geocoded: true,
    verified: false,
    source: 'test fixture',
  }));
}

/**
 * Trains every 10 min 06:00–08:00, every 5 min 08:00–09:00, 2 min per
 * segment, 30 s dwell; last train 09:00.
 */
export function line(id: string, list: TransitStation[], over: Partial<MetroLine> = {}): MetroLine {
  return {
    id,
    name: `${id} Line`,
    color: '#123456',
    active: true,
    stations: list,
    segmentMinutes: list.slice(1).map(() => n(2)),
    dwellSeconds: n(30),
    firstTrain: n('06:00'),
    lastTrain: n('09:00'),
    headways: [
      { band: 'a', from: '06:00', to: '08:00', headwayMin: n(10) },
      { band: 'b', from: '08:00', to: '24:00', headwayMin: n(5) },
    ],
    ...over,
  };
}

/** Line A (A1…A5, east–west) and line B (B1…B4, north–south) crossing at A3 / B2. */
export function metroFixture(over: Partial<MetroNetwork['fares']> = {}): MetroNetwork {
  const a = line('lineA', stations('a', ['A1', 'A2', 'A3', 'A4', 'A5']));
  const bStations = ['B1', 'B2', 'B3', 'B4'].map((name, i) => ({
    ...stations('b', [name])[0]!,
    lat: 18.51 - i * 0.01,
    lng: 73.82,
  }));
  const b = line('lineB', bStations);
  return {
    lines: [a, b],
    interchanges: [{ a: 'a-a3', b: 'b-b2', walkMinutes: n(4) }],
    fares: {
      basis: 'stations',
      interchange: 'single_journey',
      slabs: [
        { upTo: 3, fare: n(10) },
        { upTo: 6, fare: n(15, true) },
        { upTo: null, fare: n(20) },
      ],
      ...over,
    },
  };
}

export const SUB_NAMES = ['S0', 'S1', 'S2', 'S3', 'S4'];
const ALL = [0, 1, 2, 3, 4, 5, 6];

export function suburbanFixture(trips: SuburbanTrip[]): SuburbanNetwork {
  return {
    line: { id: 'sub', name: 'Test Local' },
    // ~5.3 km apart (0.05° longitude at 18.5° N).
    stations: stations('s', SUB_NAMES, 18.6, 73.6).map((s, i) => ({
      ...s,
      lng: 73.6 + i * 0.05,
      km: n(i * 6),
    })),
    fares: {
      basis: 'km',
      slabs: [
        { upTo: 10, fare: n(5) },
        { upTo: 20, fare: n(10) },
        { upTo: null, fare: n(15) },
      ],
    },
    trips,
  };
}

export const trip = (
  trainNo: string,
  times: (string | null)[],
  days = ALL,
  direction: SuburbanTrip['direction'] = 'UP',
): SuburbanTrip => ({ trainNo, direction, days, times });
