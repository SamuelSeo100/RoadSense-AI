/// <reference types="node" />
/**
 * Converts the Pune–Lonavala timetable CSV into `trips` in
 * data/transit/suburban_rail.json, after validation (see
 * src/services/transit/suburbanCsv.ts). Nothing is written if any row fails.
 *
 *   node scripts/import-suburban-csv.ts [path/to.csv] [--dry-run]
 *
 * Default CSV: data/transit/suburban_trips_template.csv. Fill it only from the
 * official Central Railway timetable.
 */
import fs from 'node:fs';
import path from 'node:path';

import { parseSuburbanCsv } from '../src/services/transit/suburbanCsv.ts';

const DATA = path.join(import.meta.dirname, '..', 'data', 'transit');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvPath =
  args.find((a) => !a.startsWith('--')) ?? path.join(DATA, 'suburban_trips_template.csv');
const jsonPath = path.join(DATA, 'suburban_rail.json');

const network = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
  stations: { name: string }[];
  trips: unknown[];
  tripsSource?: string;
};
const { trips, errors } = parseSuburbanCsv(
  fs.readFileSync(csvPath, 'utf8'),
  network.stations.map((s) => s.name),
);

if (errors.length) {
  console.error(`${errors.length} problem(s) in ${csvPath}; nothing written:\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
if (trips.length === 0) {
  console.error(`No trips in ${csvPath} (only the header / comments?). Nothing written.`);
  process.exit(1);
}

const up = trips.filter((t) => t.direction === 'UP').length;
console.log(`✓ ${trips.length} trips (${up} UP, ${trips.length - up} DOWN) from ${csvPath}`);
if (dryRun) {
  console.log('Dry run: suburban_rail.json not changed.');
} else {
  network.trips = trips;
  network.tripsSource = `Imported from ${path.basename(csvPath)} on ${new Date().toISOString().slice(0, 10)} (official Central Railway timetable, entered by hand)`;
  fs.writeFileSync(jsonPath, JSON.stringify(network, null, 2) + '\n');
  console.log(`Wrote ${jsonPath}`);
}
