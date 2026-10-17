/// <reference types="node" />
/**
 * Builds data/transit/metro.json from pune_metro_stations.csv and
 * pune_metro_fares_long.csv (Maha-Metro fare matrix). Keeps geocoded
 * coordinates from the current metro.json; nothing is written on errors.
 *
 *   node scripts/build-metro-json.ts [--dry-run]
 *
 * Run scripts/geocode-stations.ts afterwards for missing coordinates (it
 * also re-estimates segment run times).
 */
import fs from 'node:fs';
import path from 'node:path';

import { buildMetroNetwork } from '../src/services/transit/buildMetro.ts';

const DATA = path.join(import.meta.dirname, '..', 'data', 'transit');
const out = path.join(DATA, 'metro.json');
const read = (f: string) => fs.readFileSync(path.join(DATA, f), 'utf8');

let previous = null;
try {
  previous = JSON.parse(fs.readFileSync(out, 'utf8'));
} catch {
  // First build.
}

const { network, errors } = buildMetroNetwork(
  read('pune_metro_stations.csv'),
  read('pune_metro_fares_long.csv'),
  previous,
);
if (errors.length) {
  console.error(`${errors.length} problem(s); metro.json not written:\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

const pairs = Object.values(network.fares.matrix).reduce((n, row) => n + Object.keys(row).length, 0);
console.log(`✓ ${network.stations.length} stations, ${pairs} fare pairs (symmetric), lines:`);
for (const l of network.lines) console.log(`  ${l.id}: ${l.stations.length} stations${l.active ? '' : ' (inactive)'}`);
console.log(`  ${network.fares.adjusted.length} pairs use the higher of an asymmetric official fare:`);
for (const a of network.fares.adjusted) {
  console.log(`    ${a.from}↔${a.to} ₹${network.fares.matrix[a.from]?.[a.to]}: ${a.note}`);
}
const missing = network.stations.filter((s) => s.lat == null).map((s) => s.code);
if (missing.length) console.log(`  not geocoded yet: ${missing.join(' ')}`);

if (process.argv.includes('--dry-run')) {
  console.log('Dry run: metro.json not changed.');
} else {
  fs.writeFileSync(out, JSON.stringify(network, null, 2) + '\n');
  console.log(`Wrote ${out}`);
}
