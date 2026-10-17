/**
 * data/transit/suburban_trips_template.csv → SuburbanTrip[] with validation.
 * No imports: scripts/import-suburban-csv.ts runs this file directly in Node.
 *
 * Columns: train_no, direction, days, then one per station in line order
 * (Pune Jn … Lonavala). Cells: "HH:MM" (24 h IST) or "-" (doesn't stop).
 * Lines starting with # and blank lines are ignored.
 */

export interface ParsedTrip {
  trainNo: string;
  direction: 'UP' | 'DOWN';
  days: number[];
  times: (string | null)[];
}

export interface CsvResult {
  trips: ParsedTrip[];
  /** "line 4 (train 99801): …"; empty = valid. */
  errors: string[];
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "Daily" | "Mon-Sat" | "Sun" | "Mon;Wed;Fri" (also "Sat-Mon") → weekday numbers. */
export function parseDays(spec: string): number[] | null {
  const s = spec.trim().toLowerCase();
  if (s === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const part of s.split(/[;\s/|]+/).filter(Boolean)) {
    const range = /^([a-z]{3})-([a-z]{3})$/.exec(part);
    if (range) {
      const a = DAY_NAMES.indexOf(range[1] ?? '');
      const b = DAY_NAMES.indexOf(range[2] ?? '');
      if (a < 0 || b < 0) return null;
      for (let d = a; ; d = (d + 1) % 7) {
        out.add(d);
        if (d === b) break;
      }
      continue;
    }
    const d = DAY_NAMES.indexOf(part.slice(0, 3));
    if (d < 0 || part.length < 3) return null;
    out.add(d);
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}

const toMin = (s: string) => {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Splits one CSV line (double-quoted fields allowed). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Validates and converts. Times must not go backwards in the direction of
 * travel (UP = column order, DOWN = reverse); a drop of more than 12 h is
 * read as passing midnight and stored as HH ≥ 24.
 */
export function parseSuburbanCsv(csv: string, stationNames: string[]): CsvResult {
  const errors: string[] = [];
  const trips: ParsedTrip[] = [];
  const lines = csv.split(/\r?\n/).map((text, i) => ({ text, n: i + 1 }));
  const content = lines.filter((l) => l.text.trim() && !l.text.trimStart().startsWith('#'));
  const header = content.shift();
  if (!header) return { trips, errors: ['empty file (no header)'] };

  const cols = splitCsvLine(header.text);
  const expected = ['train_no', 'direction', 'days', ...stationNames];
  const missing = expected.filter((c) => !cols.includes(c));
  const extra = cols.filter((c) => !expected.includes(c));
  if (missing.length) errors.push(`header: missing column(s) ${missing.join(', ')}`);
  if (extra.length) errors.push(`header: unknown column(s) ${extra.join(', ')}`);
  if (missing.length || extra.length) return { trips, errors };
  const at = (row: string[], name: string) => row[cols.indexOf(name)] ?? '';

  const seen = new Set<string>();
  for (const { text, n } of content) {
    const row = splitCsvLine(text);
    const trainNo = at(row, 'train_no');
    const where = `line ${n}${trainNo ? ` (train ${trainNo})` : ''}`;
    const fail = (msg: string) => errors.push(`${where}: ${msg}`);
    if (row.length !== cols.length) {
      fail(`${row.length} columns, expected ${cols.length}`);
      continue;
    }
    if (!trainNo) fail('train_no is empty');
    const dirRaw = at(row, 'direction').toUpperCase();
    const direction = dirRaw === 'UP' ? 'UP' : dirRaw === 'DN' || dirRaw === 'DOWN' ? 'DOWN' : null;
    if (!direction) fail(`direction "${at(row, 'direction')}" must be UP or DOWN`);
    const days = parseDays(at(row, 'days'));
    if (!days) fail(`days "${at(row, 'days')}" not understood (Daily, Mon-Sat, Sun, Mon;Wed;Fri)`);

    const raw = stationNames.map((s) => at(row, s));
    const parsed: (number | null)[] = [];
    let cellsOk = true;
    raw.forEach((cell, i) => {
      if (cell === '-') return parsed.push(null);
      const m = toMin(cell);
      if (m === null || m >= 24 * 60) {
        cellsOk = false;
        fail(
          cell
            ? `${stationNames[i]}: "${cell}" is not HH:MM`
            : `${stationNames[i]}: empty (write - if the train does not stop)`,
        );
      }
      parsed.push(m);
    });
    if (!cellsOk || !direction || !days || !trainNo) continue;

    const stops = parsed.filter((m) => m !== null).length;
    if (stops < 2) {
      fail('stops at fewer than 2 stations');
      continue;
    }
    // Walk in travel order and unwrap midnight.
    const order = parsed.map((_, i) => i);
    if (direction === 'DOWN') order.reverse();
    const out: (number | null)[] = [...parsed];
    let prev: number | null = null;
    let shift = 0;
    let ok = true;
    for (const i of order) {
      const m = parsed[i];
      if (m === null || m === undefined) continue;
      let t = m + shift;
      if (prev !== null && t < prev) {
        if (prev - t > 12 * 60) {
          shift += 1440;
          t += 1440;
        } else {
          fail(
            `${stationNames[i]} ${fmt(m)} is earlier than the previous stop (times must increase ${direction === 'UP' ? 'from Pune Jn to Lonavala' : 'from Lonavala to Pune Jn'})`,
          );
          ok = false;
          break;
        }
      }
      out[i] = t;
      prev = t;
    }
    if (!ok) continue;
    const key = `${trainNo}|${days.join('')}`;
    if (seen.has(key)) fail('duplicate train_no for the same days');
    seen.add(key);
    trips.push({ trainNo, direction, days, times: out.map((m) => (m === null ? null : fmt(m))) });
  }
  return { trips, errors };
}
