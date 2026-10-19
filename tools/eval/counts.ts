/**
 * Part 1 counts for the paper (Tables I, II), read from the bundled transit
 * data of the frozen release.
 *
 *   node tools/eval/counts.ts [repoRoot=../routly-v1.0]
 *
 * Writes ~/routly-eval/counts.json and prints it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? join(import.meta.dirname, '../../../routly-v1.0'));
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

interface Stop {
  station: string;
}
interface Trip {
  id: string;
  trainNo: string | null;
  direction: string;
  stops: Stop[];
}
const rail = read('data/transit/suburban_rail.json') as {
  stations: { code: string }[];
  trips: Trip[];
};
const metro = read('data/transit/metro.json') as {
  stations: { code: string }[];
  lines: { id: string; name: string; active: boolean; stations: string[] }[];
  fares: { matrix: Record<string, Record<string, number>> };
};

// ---- Suburban rail ----
const tripIds = new Set(rail.trips.map((t) => t.id));
const trainNos = new Set(rail.trips.flatMap((t) => (t.trainNo ? [t.trainNo] : [])));
const servedRail = new Set(rail.trips.flatMap((t) => t.stops.map((s) => s.station)));
const byDirection: Record<string, number> = {};
for (const t of rail.trips) byDirection[t.direction] = (byDirection[t.direction] ?? 0) + 1;

// ---- Metro ----
const activeLines = metro.lines.filter((l) => l.active);
const onActiveLines = new Set(activeLines.flatMap((l) => l.stations));
const matrix = metro.fares.matrix;
const fareCells = Object.entries(matrix).flatMap(([a, row]) =>
  Object.entries(row).map(([b, fare]) => ({ a, b, fare })),
);
const offDiagonal = fareCells.filter((c) => c.a !== c.b);
const asymmetric = offDiagonal.filter((c) => matrix[c.b]?.[c.a] !== c.fare);
const csvRows = readFileSync(join(root, 'data/transit/pune_metro_fares_long.csv'), 'utf8')
  .trim()
  .split('\n')
  .slice(1).length;

const counts = {
  source: root,
  rail: {
    distinctTrips: tripIds.size,
    tripsByDirection: byDirection,
    distinctTrainNumbers: trainNos.size,
    tripsWithoutTrainNumber: rail.trips.filter((t) => !t.trainNo).length,
    stationsInFile: rail.stations.length,
    stationsServedByTrips: servedRail.size,
  },
  metro: {
    stations: metro.stations.length,
    stationsOnActiveLines: onActiveLines.size,
    linesInFile: metro.lines.length,
    activeLines: activeLines.map((l) => `${l.name} (${l.stations.length} stations)`),
    inactiveLines: metro.lines.filter((l) => !l.active).map((l) => l.name),
    farePairsInMatrix: fareCells.length,
    farePairsCsvRows: csvRows,
    farePairsOffDiagonal: offDiagonal.length,
    farePairsUnorderedDistinct: offDiagonal.length / 2,
    asymmetricOrderedPairs: asymmetric.length,
  },
};

const out = join(homedir(), 'routly-eval');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'counts.json'), JSON.stringify(counts, null, 2) + '\n');
console.log(JSON.stringify(counts, null, 2));
