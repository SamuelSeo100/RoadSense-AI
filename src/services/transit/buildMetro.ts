/**
 * Builds data/transit/metro.json from the Maha-Metro CSVs
 * (pune_metro_stations.csv, pune_metro_fares_long.csv), with validation.
 * No runtime imports: scripts run this file directly in Node.
 */
import type { MetroLine, MetroNetwork, MetroStation, Sourced } from './types';

const TIMING_SOURCE = 'secondary summary, 2026-10-17';
const sourced = <T>(value: T | null, source = TIMING_SOURCE, verified = false): Sourced<T> => ({
  value,
  verified,
  source,
});

/** Line order (Phase 1 brief). CVC (District Court) is on both. */
export const LINE_DEFS = [
  {
    id: 'purple',
    name: 'Purple Line',
    csvLine: 'Purple',
    // Google Transit's colour for the line (the existing map legend).
    color: '#903373',
    stations: [
      'PIM',
      'STG',
      'BHO',
      'KWA',
      'PGD',
      'DDI',
      'BPI',
      'KHK',
      'SJO',
      'CVC',
      'BPD',
      'MNA',
      'SGT',
    ],
  },
  {
    id: 'aqua',
    name: 'Aqua Line',
    csvLine: 'Aqua',
    color: '#039BE5',
    stations: [
      'VNZ',
      'AND',
      'ICY',
      'NST',
      'GWC',
      'DGK',
      'SAN',
      'PMC',
      'CVC',
      'MGA',
      'PRS',
      'RUC',
      'BUN',
      'YER',
      'KNA',
      'RAW',
    ],
  },
] as const;

/** Names Google Transit (or riders) use for a station besides the official one. */
const DEFAULT_ALIASES: Record<string, string[]> = {
  PIM: ['PCMC Metro Station', 'Pimpri Chinchwad'],
  BHO: ['Bhosari', 'Nashik Phata'],
  SJO: ['Shivajinagar'],
  CVC: ['Civil Court'],
  BPD: ['Budhwar Peth'],
  MNA: ['Mandai'],
  ICY: ['Ideal Colony'],
  NST: ['Nal Stop', 'SNDT College'],
  DGK: ['Deccan'],
  SAN: ['Chhatrapati Sambhaji Garden', 'Sambhaji Udyan', 'Sambhaji Park'],
  MGA: ['Mangalwar Peth', 'RTO'],
  PRS: ['Pune Station'],
  RUC: ['Ruby Hall'],
  YER: ['Yerawada'],
  RAW: ['Ramwadi Metro'],
};

/** Splits CSV text into rows of fields (double-quoted fields allowed). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
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
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Average speed for estimated run times between stations (Phase 1 brief). */
export const ESTIMATE_SPEED_KMH = 34;

/**
 * Run minutes per segment from straight-line distance at 34 km/h (dwell is
 * added by the engine). Null where a station has no coordinates yet.
 */
export function estimateSegmentMinutes(
  line: Pick<MetroLine, 'stations'>,
  stations: MetroStation[],
): Sourced<number>[] {
  const byCode = new Map(stations.map((s) => [s.code, s]));
  return line.stations.slice(1).map((code, i) => {
    const a = byCode.get(line.stations[i] ?? '');
    const b = byCode.get(code);
    const ok = a?.lat != null && a.lng != null && b?.lat != null && b.lng != null;
    if (!ok) {
      return sourced<number>(null, 'TODO_VERIFY: needs geocoded stations to estimate');
    }
    const km = haversineKm({ lat: a.lat!, lng: a.lng! }, { lat: b.lat!, lng: b.lng! });
    return {
      value: Math.round((km / ESTIMATE_SPEED_KMH) * 60 * 10) / 10,
      verified: false,
      estimated: true,
      source: `TODO_VERIFY: estimated from ${km.toFixed(2)} km straight line at ${ESTIMATE_SPEED_KMH} km/h`,
    };
  });
}

export interface BuildResult {
  network: MetroNetwork;
  /** Problems that make the data unusable; empty = valid. */
  errors: string[];
}

/**
 * Validates the CSVs and builds metro.json. `previous` (the current
 * metro.json) keeps geocoded coordinates and aliases across rebuilds.
 */
export function buildMetroNetwork(
  stationsCsv: string,
  faresCsv: string,
  previous?: Partial<MetroNetwork> | null,
): BuildResult {
  const errors: string[] = [];
  const [stHeader, ...stRows] = parseCsv(stationsCsv);
  if (stHeader?.join(',') !== 'code,name,line')
    errors.push('stations: header must be code,name,line');
  const prevByCode = new Map((previous?.stations ?? []).map((s) => [s.code, s]));
  const stations: MetroStation[] = [];
  const lineOfCsv = new Map<string, string>();
  for (const [code = '', name = '', line = ''] of stRows) {
    if (!/^[A-Z]{2,4}$/.test(code)) errors.push(`stations: bad code "${code}"`);
    if (lineOfCsv.has(code)) errors.push(`stations: duplicate code ${code}`);
    lineOfCsv.set(code, line);
    const prev = prevByCode.get(code);
    stations.push({
      code,
      name,
      aliases: prev?.aliases ?? DEFAULT_ALIASES[code],
      lat: prev?.lat ?? null,
      lng: prev?.lng ?? null,
      geocoded: prev?.geocoded ?? false,
      ...(prev?.formattedAddress ? { formattedAddress: prev.formattedAddress } : {}),
      ...(prev?.geocodeSource ? { geocodeSource: prev.geocodeSource } : {}),
      ...(prev?.geocodeQuery ? { geocodeQuery: prev.geocodeQuery } : {}),
    });
  }

  for (const def of LINE_DEFS) {
    for (const code of def.stations) {
      const csvLine = lineOfCsv.get(code);
      if (!csvLine) errors.push(`${def.name}: ${code} is not in pune_metro_stations.csv`);
      else if (!csvLine.split('+').includes(def.csvLine)) {
        errors.push(`${def.name}: ${code} is listed as "${csvLine}" in the CSV`);
      }
    }
  }
  const onLines = new Set<string>(LINE_DEFS.flatMap((d) => [...d.stations]));
  for (const s of stations) if (!onLines.has(s.code)) errors.push(`${s.code} is on no line`);

  // Fare matrix: every ordered pair once, 0 on the diagonal, symmetric.
  const [fHeader, ...fRows] = parseCsv(faresCsv);
  const want = ['from_code', 'from', 'to_code', 'to', 'fare_inr', 'source', 'checked_on'];
  if (!want.every((c, i) => fHeader?.[i] === c))
    errors.push(`fares: header must start ${want.join(',')}`);
  const matrix: Record<string, Record<string, number>> = {};
  const adjusted: MetroNetwork['fares']['adjusted'] = [];
  const sources = new Set<string>();
  const checked = new Set<string>();
  fRows.forEach((r, i) => {
    const [from = '', , to = '', , fareRaw = '', source = '', checkedOn = '', note = ''] = r;
    const where = `fares line ${i + 2} (${from}→${to})`;
    if (!lineOfCsv.has(from) || !lineOfCsv.has(to))
      return void errors.push(`${where}: unknown code`);
    const fare = Number(fareRaw);
    if (!Number.isInteger(fare) || fare < 0)
      return void errors.push(`${where}: bad fare "${fareRaw}"`);
    if (from === to ? fare !== 0 : fare === 0)
      errors.push(`${where}: fare ${fare} on the ${from === to ? '' : 'off-'}diagonal`);
    matrix[from] ??= {};
    if (matrix[from][to] !== undefined) errors.push(`${where}: duplicate pair`);
    matrix[from][to] = fare;
    sources.add(source);
    checked.add(checkedOn);
    if (note && from < to) adjusted.push({ from, to, note });
  });
  for (const a of lineOfCsv.keys()) {
    for (const b of lineOfCsv.keys()) {
      const ab = matrix[a]?.[b];
      if (ab === undefined) errors.push(`fares: missing ${a}→${b}`);
      else if (matrix[b]?.[a] !== undefined && matrix[b]![a] !== ab) {
        if (a < b) errors.push(`fares: ${a}→${b} ₹${ab} but ${b}→${a} ₹${matrix[b]![a]}`);
      }
    }
  }

  const prevLine = new Map((previous?.lines ?? []).map((l) => [l.id, l]));
  const lines: MetroLine[] = LINE_DEFS.map((def) => {
    const line = {
      id: def.id,
      name: def.name,
      color: def.color,
      active: true,
      stations: [...def.stations],
    };
    const prevSegs = prevLine.get(def.id)?.segmentMinutes;
    // Keep segment times someone has verified; re-estimate the rest.
    const estimates = estimateSegmentMinutes(line, stations);
    return {
      ...line,
      segmentMinutes: estimates.map((e, i) => (prevSegs?.[i]?.verified ? prevSegs[i]! : e)),
      dwellSeconds: sourced(30),
      firstTrain: sourced('06:00'),
      lastTrain: sourced('22:00'),
      headways: [
        { band: 'peak_am', from: '08:00', to: '11:00', headwayMin: sourced(10) },
        { band: 'peak_pm', from: '17:00', to: '20:00', headwayMin: sourced(10) },
      ],
      offPeakHeadwayMin: sourced(15),
    };
  });
  lines.push({
    id: 'line3',
    name: 'Line 3 (Hinjewadi–Shivajinagar)',
    color: '#1F5FAD',
    active: false,
    stations: [],
    segmentMinutes: [],
    dwellSeconds: sourced<number>(null, 'TODO_VERIFY'),
    firstTrain: sourced<string>(null, 'TODO_VERIFY'),
    lastTrain: sourced<string>(null, 'TODO_VERIFY'),
    headways: [],
    offPeakHeadwayMin: sourced<number>(null, 'TODO_VERIFY'),
  });

  return {
    errors,
    network: {
      stations,
      lines,
      interchanges: [
        {
          station: 'CVC',
          lines: ['purple', 'aqua'],
          walkMinutes: sourced(4, 'TODO_VERIFY: Phase 1 brief placeholder'),
        },
      ],
      fares: {
        source: [...sources].join('; '),
        checkedOn: [...checked].join('; '),
        verified: true,
        matrix,
        adjusted,
      },
    },
  };
}
