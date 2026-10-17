/**
 * Shapes of data/transit/*.json. Every number carries where it came from:
 * `verified: false` + a `source` starting with TODO_VERIFY marks a
 * placeholder, not published data. `value: null` = unknown.
 */
export interface Sourced<T> {
  value: T | null;
  verified: boolean;
  source: string;
}

export interface TransitStation {
  /** "line2-vanaz", "sub-akurdi". A physical station on two lines has one id per line. */
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
  verified: boolean;
  source: string;
  /** Other names Google Transit uses ("Kasba Peth"). */
  aliases?: string[];
  /** False: trains pass without stopping (under construction). Default true. */
  open?: boolean;
}

export interface HeadwayBand {
  band: string;
  /** "06:00"; `to` is exclusive and may be "24:00". */
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
  stations: TransitStation[];
  /** Run time between consecutive stations (stations.length − 1 entries). */
  segmentMinutes: Sourced<number>[];
  dwellSeconds: Sourced<number>;
  /** First / last departure from either terminal, "HH:MM" IST. */
  firstTrain: Sourced<string>;
  lastTrain: Sourced<string>;
  headways: HeadwayBand[];
}

export interface Interchange {
  /** Station ids on two different lines. */
  a: string;
  b: string;
  walkMinutes: Sourced<number>;
}

export interface FareSlab {
  /** Max stations travelled (or km); null = no upper bound. */
  upTo: number | null;
  fare: Sourced<number>;
}

export interface FareTable {
  basis: 'stations' | 'km';
  slabs: FareSlab[];
}

export interface MetroNetwork {
  lines: MetroLine[];
  interchanges: Interchange[];
  fares: FareTable & {
    /** 'single_journey': one fare across an interchange. */
    interchange: 'single_journey' | 'per_line';
    /** Lines run by another operator, with their own table (Line 3). */
    line3?: { slabs: FareSlab[] };
  };
}

export type SuburbanDirection = 'UP' | 'DOWN';

export interface SuburbanTrip {
  trainNo: string;
  direction: SuburbanDirection;
  /** Days the trip starts on (0 = Sunday). */
  days: number[];
  /**
   * Departure per station, in `stations` order; null = doesn't stop. "HH:MM"
   * with HH ≥ 24 for after midnight of the service day.
   */
  times: (string | null)[];
}

export interface SuburbanStation extends TransitStation {
  /** Chainage from Pune Jn. */
  km: Sourced<number>;
}

export interface SuburbanNetwork {
  line: { id: string; name: string };
  stations: SuburbanStation[];
  fares: FareTable;
  trips: SuburbanTrip[];
}
