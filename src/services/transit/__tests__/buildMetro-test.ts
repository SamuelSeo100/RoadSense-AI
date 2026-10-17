import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { buildMetroNetwork, estimateSegmentMinutes } from '../buildMetro';

const DATA = path.join(__dirname, '../../../../data/transit');
const stationsCsv = fs.readFileSync(path.join(DATA, 'pune_metro_stations.csv'), 'utf8');
const faresCsv = fs.readFileSync(path.join(DATA, 'pune_metro_fares_long.csv'), 'utf8');

describe('buildMetroNetwork', () => {
  it('builds the bundled CSVs without errors', () => {
    const { network, errors } = buildMetroNetwork(stationsCsv, faresCsv);
    expect(errors).toEqual([]);
    expect(network.stations).toHaveLength(28);
    expect(network.lines.map((l) => [l.id, l.stations.length, l.active])).toEqual([
      ['purple', 13, true],
      ['aqua', 16, true],
      ['line3', 0, false],
    ]);
    expect(network.fares.matrix.PGD?.SGT).toBe(30);
    expect(network.fares.matrix.SGT?.PGD).toBe(30);
    expect(network.fares.adjusted).toHaveLength(10);
    // "R.T.O., Pune" survives the quoted comma.
    expect(network.stations.find((s) => s.code === 'MGA')?.name).toBe('R.T.O., Pune');
  });

  it('rejects an asymmetric, missing or duplicated fare', () => {
    const rows = faresCsv.trim().split('\n');
    const header = rows[0]!;
    const body = rows.slice(1);
    const pgdSgt = body.findIndex((r) => r.startsWith('PGD,Phugewadi,SGT,'));
    const changed = [...body];
    changed[pgdSgt] = changed[pgdSgt]!.replace(',30,', ',35,');
    expect(buildMetroNetwork(stationsCsv, [header, ...changed].join('\n')).errors).toContain(
      'fares: PGD→SGT ₹35 but SGT→PGD ₹30',
    );
    const missing = body.filter((_, i) => i !== pgdSgt);
    expect(buildMetroNetwork(stationsCsv, [header, ...missing].join('\n')).errors).toContain(
      'fares: missing PGD→SGT',
    );
    const dup = [...body, body[pgdSgt]!];
    expect(buildMetroNetwork(stationsCsv, [header, ...dup].join('\n')).errors.join()).toMatch(
      /duplicate pair/,
    );
  });

  it('keeps coordinates from the previous metro.json', () => {
    const previous = {
      stations: [{ code: 'PIM', name: 'PCMC', lat: 18.6, lng: 73.8, geocoded: true }],
    };
    const { network } = buildMetroNetwork(stationsCsv, faresCsv, previous);
    expect(network.stations.find((s) => s.code === 'PIM')).toMatchObject({
      lat: 18.6,
      geocoded: true,
    });
  });
});

describe('estimateSegmentMinutes', () => {
  it('uses straight-line distance at 34 km/h and flags the estimate', () => {
    const stations = [
      { code: 'A', name: 'A', lat: 18.5, lng: 73.8, geocoded: true },
      // 0.0306° of latitude ≈ 3.4 km → 6 min.
      { code: 'B', name: 'B', lat: 18.5306, lng: 73.8, geocoded: true },
      { code: 'C', name: 'C', lat: null, lng: null, geocoded: false },
    ];
    const [ab, bc] = estimateSegmentMinutes({ stations: ['A', 'B', 'C'] }, stations);
    expect(ab).toMatchObject({ value: 6, verified: false, estimated: true });
    expect(bc?.value).toBeNull();
  });
});
