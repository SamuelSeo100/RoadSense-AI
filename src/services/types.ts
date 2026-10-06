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
  /** "Fits your history". */
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
}

export interface AiQuery {
  from?: string;
  to: string;
  priority?: Priority;
}

// ---- Services ----

export interface RoutingService {
  getRoutes(
    from: Place | LatLng,
    to: Place,
    opts: { priority: Priority; vehicles: Record<Vehicle, boolean> },
  ): Promise<RankedRoute[]>;
  /** The 3 cards on Home: AI pick, cheapest, fastest. */
  getPreview(from: Place | LatLng, to: Place): Promise<Route[]>;
  searchPlaces(query: string): Promise<Place[]>;
  /** Best match for a free-text name ("Pune Station", "College"), or null. */
  geocode(name: string): Promise<Place | null>;
}

export interface HistoryService {
  getTrips(): Promise<Trip[]>;
  getMonthlyStats(): Promise<MonthlyStats>;
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

export const PRIORITIES: readonly Priority[] = ['fastest', 'cheapest', 'walking', 'transfers'];

export const priorityLabels: Record<Priority, string> = {
  fastest: 'Fastest',
  cheapest: 'Cheapest',
  walking: 'Least walking',
  transfers: 'Fewest transfers',
};
