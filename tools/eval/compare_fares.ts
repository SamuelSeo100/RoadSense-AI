/**
 * Part 4.14: app metro fares vs the official chart (Table V, fares).
 *
 *   npx --prefix tools/eval tsx tools/eval/compare_fares.ts <filled.csv> [--app <fare-check-app.csv>] [--out <dir>]
 *
 * <filled.csv> is fare-check-blank.csv as Tejas returns it: official_fare
 * (from → to) and official_fare_reverse (to → from), whole rupees, both read
 * from the official chart. A pair is symmetric_in_chart = Y when the two
 * official fares are equal; that column is written back into the app sheet.
 * Pairs whose two official directions differ are listed as asymmetric.
 *
 * Every direction is one comparison (100 pairs → 200). Exits non-zero, with
 * nothing written, if any official fare is missing or not a number.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { OUT_DIR, readCsv, writeCsv } from './lib.ts';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const appPath = flag('--app') ?? join(OUT_DIR, 'fare-check-app.csv');
const filledPath = args[0];
if (!filledPath) {
  console.error('usage: compare_fares.ts <filled.csv> [--app <csv>] [--out <dir>]');
  process.exit(2);
}
const outDir = flag('--out') ?? dirname(appPath);

const app = readCsv(appPath);
const official = new Map(readCsv(filledPath).map((r) => [r.pair_id, r]));

const rupees = (s: string | undefined) => (s && /^\d+(\.\d+)?$/.test(s) ? Number(s) : null);

const problems: string[] = [];
for (const a of app) {
  const o = official.get(a.pair_id ?? '');
  if (!o) problems.push(`${a.pair_id}: missing from the filled sheet`);
  else
    for (const col of ['official_fare', 'official_fare_reverse'] as const)
      if (rupees(o[col]) === null) problems.push(`${a.pair_id}: ${col} = "${o[col] ?? ''}"`);
}
for (const id of official.keys())
  if (!app.some((a) => a.pair_id === id)) problems.push(`${id}: not in the app sheet`);
if (problems.length) {
  console.error(`Filled sheet is incomplete (${problems.length} problems):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

interface Comparison {
  pair_id: string;
  direction: 'forward' | 'reverse';
  from: string;
  to: string;
  symmetric: boolean;
  official: number;
  app: number | null;
  error: number | null;
}

const comparisons: Comparison[] = [];
const asymmetric: { pair_id: string; from: string; to: string; forward: number; reverse: number }[] =
  [];
const appOut = app.map((a) => {
  const o = official.get(a.pair_id ?? '')!;
  const fwd = rupees(o.official_fare)!;
  const rev = rupees(o.official_fare_reverse)!;
  const symmetric = fwd === rev;
  const from = o.from_station ?? a.from_code ?? '';
  const to = o.to_station ?? a.to_code ?? '';
  if (!symmetric) asymmetric.push({ pair_id: a.pair_id!, from, to, forward: fwd, reverse: rev });
  for (const [direction, off, appFare] of [
    ['forward', fwd, rupees(a.app_fare)],
    ['reverse', rev, rupees(a.app_fare_reverse)],
  ] as const) {
    comparisons.push({
      pair_id: a.pair_id!,
      direction,
      from: direction === 'forward' ? from : to,
      to: direction === 'forward' ? to : from,
      symmetric,
      official: off,
      app: appFare,
      error: appFare === null ? null : Math.abs(appFare - off),
    });
  }
  return { ...a, symmetric_in_chart: symmetric ? 'Y' : 'N' };
});

const pct = (k: number, n: number) => (n ? Math.round((1000 * k) / n) / 10 : null);
function summary(cs: Comparison[]) {
  const errors = cs.flatMap((c) => (c.error === null ? [] : [c.error]));
  const ids = [...new Set(cs.map((c) => c.pair_id))];
  const pairExact = ids.filter((id) =>
    cs.filter((c) => c.pair_id === id).every((c) => c.error === 0),
  ).length;
  return {
    pairs: ids.length,
    comparisons: cs.length,
    exactMatches: cs.filter((c) => c.error === 0).length,
    exactMatchPct: pct(cs.filter((c) => c.error === 0).length, cs.length),
    pairsExactBothDirections: pairExact,
    pairsExactBothDirectionsPct: pct(pairExact, ids.length),
    appFareMissing: cs.filter((c) => c.app === null).length,
    meanAbsErrorInr: errors.length
      ? Math.round((100 * errors.reduce((s, e) => s + e, 0)) / errors.length) / 100
      : null,
    maxAbsErrorInr: errors.length ? Math.max(...errors) : null,
  };
}

const result = {
  filledSheet: filledPath,
  appSheet: appPath,
  overall: summary(comparisons),
  symmetric: summary(comparisons.filter((c) => c.symmetric)),
  asymmetric: summary(comparisons.filter((c) => !c.symmetric)),
  asymmetricInOfficialChart: asymmetric,
  mismatches: comparisons.filter((c) => c.error !== 0),
};

writeCsv(
  appPath,
  ['pair_id', 'from_code', 'to_code', 'app_fare', 'app_fare_reverse', 'symmetric_in_chart'],
  appOut,
);
writeCsv(
  join(outDir, 'fare-check-mismatches.csv'),
  ['pair_id', 'direction', 'from', 'to', 'symmetric', 'official', 'app', 'error'],
  result.mismatches.map((m) => ({ ...m, symmetric: m.symmetric ? 'Y' : 'N' })),
);
writeFileSync(join(outDir, 'fare-check-results.json'), JSON.stringify(result, null, 2) + '\n');

console.log(JSON.stringify({ ...result, mismatches: undefined }, null, 2));
console.log(`\nMismatches (${result.mismatches.length}):`);
for (const m of result.mismatches)
  console.log(
    `  ${m.pair_id} ${m.direction.padEnd(7)} ${m.from} → ${m.to}: official ₹${m.official}, app ${m.app === null ? 'none' : `₹${m.app}`}${m.symmetric ? '' : ' [asymmetric]'}`,
  );
if (asymmetric.length) {
  console.log(`\nOfficial chart differs by direction (${asymmetric.length}):`);
  for (const a of asymmetric)
    console.log(`  ${a.pair_id} ${a.from} ↔ ${a.to}: ₹${a.forward} / ₹${a.reverse}`);
}
