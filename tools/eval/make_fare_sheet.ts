/**
 * Part 4.13: draw 100 metro station pairs (seed 2026) for the fare check.
 *
 *   npx --prefix tools/eval tsx tools/eval/make_fare_sheet.ts
 *
 * Draw: every unordered pair of two different stations on active lines
 * (stations in metro.json order, i < j), shuffled with mulberry32(2026); the
 * first 100 are kept and each is oriented from → to by the next draw.
 *
 * Writes to ~/routly-eval:
 *   fare-check-blank.csv  for Tejas: official fares from the official chart, both directions
 *   fare-check-app.csv    private: the app's fares (v1.0 `metroFare`), both directions.
 *                         symmetric_in_chart is left empty: compare_fares.ts sets it
 *                         from Tejas's two official fares, not from our matrix.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SEED, V1_ROOT, mulberry32, outPath, shuffled, writeCsv } from './lib.ts';

const N = 100;

interface Station {
  code: string;
  name: string;
}
// The frozen release's own fare lookup (what the app shows), not a re-implementation.
const network = (await import(
  pathToFileURL(join(V1_ROOT, 'src/services/transit/network.ts')).href
)) as {
  metroNetwork: unknown;
  activeMetroStations: (n: unknown) => Station[];
  metroFare: (a: string, b: string) => { fare: number; verified: boolean } | null;
};

const stations = network.activeMetroStations(network.metroNetwork);
const pairs: [Station, Station][] = [];
stations.forEach((a, i) => stations.slice(i + 1).forEach((b) => pairs.push([a, b])));

const rand = mulberry32(SEED);
const drawn = shuffled(pairs, rand)
  .slice(0, N)
  .map(([a, b]) => (rand() < 0.5 ? [a, b] : [b, a]) as [Station, Station]);

const fareOf = (a: Station, b: Station) => network.metroFare(a.code, b.code)?.fare ?? '';
const rows = drawn.map(([from, to], i) => ({
  pair_id: `F${String(i + 1).padStart(3, '0')}`,
  from_code: from.code,
  from_station: from.name,
  to_code: to.code,
  to_station: to.name,
  official_fare: '',
  official_fare_reverse: '',
  app_fare: fareOf(from, to),
  app_fare_reverse: fareOf(to, from),
  symmetric_in_chart: '',
}));

const blank = outPath('fare-check-blank.csv');
const app = outPath('fare-check-app.csv');
writeCsv(
  blank,
  ['pair_id', 'from_station', 'to_station', 'official_fare', 'official_fare_reverse'],
  rows,
);
writeCsv(
  app,
  ['pair_id', 'from_code', 'to_code', 'app_fare', 'app_fare_reverse', 'symmetric_in_chart'],
  rows,
);
console.log(
  `${stations.length} stations, ${pairs.length} unordered pairs, drew ${rows.length} (seed ${SEED})`,
);
console.log(`missing app fares: ${rows.filter((r) => r.app_fare === '').length}`);
console.log(blank);
console.log(app);
