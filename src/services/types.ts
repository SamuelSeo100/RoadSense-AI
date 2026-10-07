/**
 * Data contracts for the signed-in screens (routly-internal-screens/specs/types.ts).
 * Screens depend only on these types and the service interfaces: the mocks in
 * `./mock` implement them now, the Django/Flask API will later.
 */
import type { Mode } from '@/theme/routly';

export type { Mode };
export type Priority = 'fastest' | 'cheapest' | 'walking' | 'transfers';
export type Vehicle = 'car' | 'bike' | 'cycle';
export type TrafficLevel = 'Light' | 'Moderate' | 'Heavy';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  /** "Pune Station" */
  name: string;
  /** "Pimpri" */
  area?: string;
  location: LatLng;
}

export interface Leg {
  mode: Mode;
  /** "Walk 5m", "Metro", "Bus 312", "Auto 12m" */
  label: string;
  durationMin: number;
  costInr?: number;
  /** Geometry for the map. */
  polyline?: LatLng[];
  /** True when `polyline` is a stand-in (straight line / borrowed path), not real geometry. */
  approximate?: boolean;
  distanceKm?: number;
  /** Transit legs: stops travelled (Google's stopCount). */
  stops?: number;
  from?: string;
  to?: string;
}

export interface Route {
  id: string;
  /** Short name for buttons: "Metro", "Bus + Walk", "Cab". */
  name: string;
  /** Which map highlight this route corresponds to ("metro", "bus", "cab", "all"). */
  mapKey: string;
  /** Set only for car/bike/cycle-based routes (used by filters). */
  vehicle?: Vehicle;
  durationMin: number;
  costInr: number;
  walkingKm: number;
  transfers: number;
  traffic: TrafficLevel;
  legs: Leg[];
  /** Lower = better, per priority; produced by the ML ranking service. */
  score: Record<Priority, number>;
  /** Shown as "Top pick" (heuristic). TODO(ml): "AI pick" once the learned ranker is live. */
  aiPick?: boolean;
  /** Preview line: "0.7 km walk · 0 transfers · Low traffic". */
  meta?: string;
}

export interface RankedRoute extends Route {
  rank: number;
  isBest: boolean;
}

export interface Trip {
  id: string;
  /** "TODAY" | "YESTERDAY" | weekday */
  dayLabel: string;
  from: string;
  to: string;
  mode: Mode;
  /** "Metro", "Bus + Walk" */
  modeLabel: string;
  /** "9:12 AM" */
  startTime: string;
  durationMin: number;
  costInr: number;
  /** Recorded path, for showing the trip on the map. */
  path?: LatLng[];
  /** Per-leg geometry (mode-coloured on the map) when the trip was logged with it. */
  legs?: Leg[];
}

export interface MonthlyStats {
  trips: number;
  spentInr: number;
  savedVsCabInr: number;
  modeMix: { mode: Mode; percent: number }[];
}

export interface SavedPlace {
  id: string;
  label: 'Home' | 'College' | 'Work' | (string & {});
  place?: Place;
}

export interface Preferences {
  defaultPriority: Priority;
  learnFromTrips: boolean;
  voiceForAiMode: boolean;
  liveTrafficAlerts: boolean;
  aiModeEnabled: boolean;
  quickLaunchEnabled: boolean;
  /** "power+volume_up" (UI only for now). */
  quickLaunchCombo: string;
  vehicles: Record<Vehicle, boolean>;
  savedPlaces: SavedPlace[];
  /** Booking providers the user has linked (Profile › Linked apps). */
  linkedApps: string[];
  /** Google's live traffic lines on the map (Profile › Travel preferences). */
  showTraffic: boolean;
}

export interface AiQuery {
  from?: string;
  to: string;
  priority?: Priority;
}

/** A routing mode group that can fail on its own. */
export type RouteSource = 'transit' | 'road' | 'bike' | 'walk';

/** Something the Routes screen should tell the user about the results. */
export type RouteNotice =
  /** No bus or metro option right now (late night, or outside coverage). */
  | { kind: 'transitUnavailable' }
  /** Metro isn't running at this hour; transit options are buses only. */
  | { kind: 'metroClosed' }
  /** Some modes failed; the rest are shown. */
  | { kind: 'partialFailure'; failed: RouteSource[] };

export interface RoutesResult {
  /**
   * Ranked for the requested priority. Each route carries scores for every
   * priority, so callers can re-rank locally with `rankRoutes`.
   */
  routes: RankedRoute[];
  notices: RouteNotice[];
}

// ---- Services ----

export interface RoutingService {
  getRoutes(
    from: Place | LatLng,
    to: Place,
    opts: { priority: Priority; vehicles: Record<Vehicle, boolean>; signal?: AbortSignal },
  ): Promise<RoutesResult>;
  /** The 3 cards on Home: top pick, cheapest, fastest. */
  getPreview(from: Place | LatLng, to: Place): Promise<Route[]>;
  searchPlaces(query: string): Promise<Place[]>;
  /** Best match for a free-text name ("Pune Station", "College"), or null. */
  geocode(name: string): Promise<Place | null>;
}

export interface HistoryService {
  getTrips(): Promise<Trip[]>;
  getMonthlyStats(): Promise<MonthlyStats>;
  /** Deletes the user's trips, route requests and choices. */
  clearHistory(): Promise<void>;
}

/** What the user did with a shown route option (ranker label strength differs). */
export type ChoiceAction = 'expand' | 'book' | 'ticket' | 'start';

/** One ranked result the user was shown. */
export interface RouteRequestLog {
  /** Client-generated UUID, so choices can reference it before the insert lands. */
  id: string;
  at: Date;
  from: { name: string; location: LatLng };
  to: { name: string; location: LatLng };
  priority: Priority;
  routes: RankedRoute[];
}

export interface StartTripLog {
  /** Null when the request wasn't logged ("Learn from my trips" off). */
  requestId: string | null;
  at: Date;
  from: string;
  to: string;
  route: Route;
  /** Cab estimate for the same trip ("saved vs cab"), when known. */
  cabEquivalentInr: number | null;
}

/**
 * Route requests, choices and trips (History + ML ranker training data).
 * Fire-and-forget: methods never throw and never block the UI. Writes are
 * queued on the device until the server has them (they survive restarts).
 */
export interface TripLogService {
  logRequest(request: RouteRequestLog): void;
  logChoice(choice: {
    requestId: string;
    route: RankedRoute;
    /** Ranking the user was looking at (may differ from the request's). */
    priority: Priority;
    action: ChoiceAction;
  }): void;
  startTrip(trip: StartTripLog): void;
  /** Called whenever a trip lands on the server (possibly after a retry). Returns unsubscribe. */
  onTripStored(listener: () => void): () => void;
  /** Drops queued writes not yet sent (before "Clear my trip history"). */
  clearPending(): void;
}

export interface AiService {
  parseQuery(text: string): Promise<AiQuery | null>;
}

export interface PreferencesService {
  get(): Promise<Preferences>;
  update(patch: Partial<Preferences>): Promise<Preferences>;
}

export type LocationPermission = 'granted' | 'denied';

export interface LocationService {
  requestPermission(): Promise<LocationPermission>;
  /** Returns an unsubscribe function. */
  watch(cb: (pos: LatLng) => void): () => void;
  /** Neighbourhood name for "You · {area}", or null when unknown. */
  areaName(pos: LatLng): Promise<string | null>;
}

export interface PlaceSuggestion {
  placeId: string;
  /** "Pune Railway Station" */
  primary: string;
  /** "Agarkar Nagar, Pune, Maharashtra" */
  secondary?: string;
}

/** Place search (Google Places API (New) when a key is configured). */
export interface PlacesService {
  /**
   * Suggestions for a partial query. `sessionToken` groups the keystrokes of
   * one search with the final `details` call into a single billed session.
   */
  autocomplete(
    input: string,
    opts: { sessionToken: string; near?: LatLng; signal?: AbortSignal },
  ): Promise<PlaceSuggestion[]>;
  /** Coordinates and name for a picked suggestion (ends the session). */
  details(placeId: string, opts: { sessionToken: string; signal?: AbortSignal }): Promise<Place>;
}

export interface WalkingRoute {
  distanceMeters: number;
  durationSec: number;
  path: LatLng[];
  /** Main roads, e.g. "Service Rd and Old Mumbai Hwy". */
  via?: string;
  /** Provider warnings, e.g. "This route may be missing sidewalks". */
  warnings: string[];
  safety: {
    /** Picked with night-time rules (20:00–06:00 local). */
    night: boolean;
    /** Seconds slower than the fastest alternative (0 = it is the fastest). */
    extraSec: number;
    /** Why this route was chosen, for the UI. */
    notes: string[];
  };
}

/** Turn-by-turn geometry (Google Routes API when a key is configured). */
export interface DirectionsService {
  /** The safest sensible walking route at time `at` (default: now). */
  walking(
    from: LatLng,
    to: LatLng,
    opts?: { signal?: AbortSignal; at?: Date },
  ): Promise<WalkingRoute>;
}

/** An area to route around: crime reports, unlit stretches, closures… */
export interface UnsafeZone {
  center: LatLng;
  radiusM: number;
  /** Only avoided at night (e.g. unlit or deserted after dark). */
  nightOnly: boolean;
  reason: string;
}

/** Safety data for routing. TODO(safety): backend-fed (reports, lighting, closures). */
export interface SafetyService {
  unsafeZones(near: LatLng): Promise<UnsafeZone[]>;
}

export const PRIORITIES: readonly Priority[] = ['fastest', 'cheapest', 'walking', 'transfers'];

export const priorityLabels: Record<Priority, string> = {
  fastest: 'Fastest',
  cheapest: 'Cheapest',
  walking: 'Least walking',
  transfers: 'Fewest transfers',
};
