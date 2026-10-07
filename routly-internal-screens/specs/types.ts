// Routly data contracts for the internal screens.
// Screens depend only on these types + the service interfaces; mocks implement them now, the real API later.

export type Mode = 'walk' | 'metro' | 'bus' | 'auto' | 'cab' | 'bike' | 'cycle' | 'train';
export type Priority = 'fastest' | 'cheapest' | 'walking' | 'transfers';
export type Vehicle = 'car' | 'bike' | 'cycle';
export type TrafficLevel = 'Light' | 'Moderate' | 'Heavy';
export type MapSelection = 'metro' | 'bus' | 'cab' | 'all' | 'none' | string; // or a route id

export interface LatLng { latitude: number; longitude: number }

export interface Place {
  id: string;
  name: string;            // "Pune Station"
  area?: string;           // "Pimpri"
  location: LatLng;
}

export interface Leg {
  mode: Mode;
  label: string;           // "Walk 5m", "Metro", "Bus 312", "Auto 12m"
  durationMin: number;
  costInr?: number;
  polyline?: LatLng[];     // geometry for the map
  from?: string;
  to?: string;
}

export interface Route {
  id: string;
  name: string;            // short name for buttons: "Metro", "Bus + Walk", "Cab"
  mapKey: MapSelection;    // which map highlight this route corresponds to
  vehicle?: Vehicle;       // set only for car/bike/cycle-based routes (used by filters)
  durationMin: number;
  costInr: number;
  walkingKm: number;
  transfers: number;
  traffic: TrafficLevel;
  legs: Leg[];
  // lower = better, per priority; produced by the ML ranking service
  score: Record<Priority, number>;
  aiPick?: boolean;        // "fits your history"
  meta?: string;           // preview line: "0.7 km walk · 0 transfers · Low traffic"
}

export interface RankedRoute extends Route { rank: number; isBest: boolean }

export interface Trip {
  id: string;
  dayLabel: string;        // "TODAY" | "YESTERDAY" | weekday
  from: string;
  to: string;
  mode: Mode;
  modeLabel: string;       // "Metro", "Bus + Walk"
  startTime: string;       // "9:12 AM"
  durationMin: number;
  costInr: number;
}

export interface MonthlyStats {
  trips: number;
  spentInr: number;
  savedVsCabInr: number;
  modeMix: { mode: Mode; percent: number }[];
}

export interface Preferences {
  defaultPriority: Priority;
  learnFromTrips: boolean;
  voiceForAiMode: boolean;
  liveTrafficAlerts: boolean;
  aiModeEnabled: boolean;
  quickLaunchEnabled: boolean;
  quickLaunchCombo: string;      // "power+volume_up" (UI only for now)
  vehicles: Record<Vehicle, boolean>;
  savedPlaces: { id: string; label: 'Home' | 'College' | 'Work' | string; place?: Place }[];
}

export interface AiQuery { from?: string; to: string; priority?: Priority }

// ---- Services ----
export interface RoutingService {
  getRoutes(from: Place | LatLng, to: Place, opts: { priority: Priority; vehicles: Record<Vehicle, boolean> }): Promise<RankedRoute[]>;
  getPreview(from: Place | LatLng, to: Place): Promise<Route[]>; // 3 cards on Home
  searchPlaces(query: string): Promise<Place[]>;
}
export interface HistoryService {
  getTrips(): Promise<Trip[]>;
  getMonthlyStats(): Promise<MonthlyStats>;
}
export interface AiService { parseQuery(text: string): Promise<AiQuery | null> }
export interface PreferencesService {
  get(): Promise<Preferences>;
  update(patch: Partial<Preferences>): Promise<Preferences>;
}
export interface LocationService {
  requestPermission(): Promise<'granted' | 'denied'>;
  watch(cb: (pos: LatLng) => void): () => void; // returns unsubscribe
}

// Reference ranking used by the mock (real ranking comes from the backend ML model)
export function rankRoutes(routes: Route[], priority: Priority, vehicles: Record<Vehicle, boolean>): RankedRoute[] {
  return routes
    .filter(r => !r.vehicle || vehicles[r.vehicle])
    .sort((a, b) => a.score[priority] - b.score[priority])
    .map((r, i) => ({ ...r, rank: i + 1, isBest: i === 0 }));
}
