/**
 * Shapes of data/transit/*.json. Station codes (PIM, CVC, PUNE, LNL…) are
 * the ids everywhere; names are display-only.
 *
 * Numbers carry where they came from: `verified: false` = not yet checked
 * against an official source (the TODO_VERIFY list); `estimated: true` =
 * computed by us, not published at all. `value: null` = unknown.
 */
export interface Sourced<T> {
  value: T | null;
  verified: boolean;
  source: string;
  estimated?: boolean;
  /** Estimate scaled to match this reference (e.g. Google Transit end-to-end times on a date). */
  calibratedTo?: string;
}

/** Coordinates written by scripts/geocode-stations.ts. */
export interface Geocoded {
  lat?: number | null;
  lng?: number | null;
  geocoded: boolean;
  formattedAddress?: string;
  geocodeSource?: string;
  /** Overrides the default Places query when the plain name matches the wrong place. */
  geocodeQuery?: string;
}

export interface MetroStation extends Geocoded {
  code: string;
  name: string;
  /** Other names Google Transit uses ("Civil Court", "Chhatrapati Sambhaji Garden"). */
  aliases?: string[];
}

export interface HeadwayBand {
  band: string;
  /** "08:00"; `to` is exclusive. */
  from: string;
  to: string;
  headwayMin: Sourced<number>;
}

export interface MetroLine {
  id: string;
  name: string;
  /** Map colour of the line. */
  color: string;
  /** Only active lines are routed. */
  active: boolean;
  /** Station codes in line order. */
  stations: string[];
  /** Run time between consecutive stations (stations.length − 1 entries), dwell excluded. */
  segmentMinutes: Sourced<number>[];
  dwellSeconds: Sourced<number>;
  /** First / last departure from either terminal, "HH:MM" IST. */
  firstTrain: Sourced<string>;
  lastTrain: Sourced<string>;
  /** Peak bands; any other time in service uses `offPeakHeadwayMin`. */
  headways: HeadwayBand[];
  offPeakHeadwayMin: Sourced<number>;
}

export interface Interchange {
  /** A station code on every line in `lines`. */
  station: string;
  lines: string[];
  walkMinutes: Sourced<number>;
}

export interface MetroFares {
  source: string;
  checkedOn: string;
  verified: boolean;
  /** fare[from][to] in ₹, symmetric. */
  matrix: Record<string, Record<string, number>>;
  /** Pairs where the official chart was asymmetric (the higher fare is used both ways). */
  adjusted: { from: string; to: string; note: string }[];
}

export interface MetroNetwork {
  stations: MetroStation[];
  lines: MetroLine[];
  interchanges: Interchange[];
  fares: MetroFares;
}

export interface SuburbanStation extends Geocoded {
  code: string;
  name: string;
  kmFromPune: number;
}

export interface SuburbanStop {
  station: string;
  /** "HH:MM" IST. */
  time: string;
  /** Days after the trip's start day (1 = after midnight). */
  dayOffset: number;
}

export interface SuburbanTrip {
  id: string;
  /** "1ST LOCAL", "Local 21". */
  label: string;
  direction: 'UP' | 'DOWN';
  origin: string;
  terminus: string;
  /** Weekdays (0 = Sunday) or "TODO_VERIFY" (treated as daily). */
  days: number[] | string;
  trainNo: string | null;
  /** Stations served, in order of travel (short workings list fewer). */
  stops: SuburbanStop[];
}

export interface SuburbanNetwork {
  line: { id: string; name: string };
  source: { name: string; author: string; credit: string };
  stations: SuburbanStation[];
  fare: {
    slabs: { maxKm: number; fareInr: number }[];
    verified: boolean;
    source: string;
  };
  trips: SuburbanTrip[];
  /** "UP 10TH LOCAL: 19 min gap before LNL (13:50) - check". */
  dataIssues: string[];
}
