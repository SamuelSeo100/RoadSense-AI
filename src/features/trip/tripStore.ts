import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import {
  directionsService,
  placesService,
  rankRoutes,
  routingService,
  type LatLng,
  type Place,
  type Priority,
  type RankedRoute,
  type RouteNotice,
  type Vehicle,
  type WalkingRoute,
} from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

import { useMapStore } from '../map/mapStore';

import { logRequest } from './tripLog';

/** From is either the live GPS position or a searched place. */
export type Endpoint = { kind: 'current' } | { kind: 'place'; place: Place };

export type RoutesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready';
      /**
       * New per fetch (UUID): keys the selection (a re-rank keeps it) and is the
       * logged route_requests id that choices and trips refer to.
       */
      requestId: string;
      /** As returned; re-rank locally with `rankRoutes` for the current priority. */
      routes: RankedRoute[];
      notices: RouteNotice[];
      /** Safe-walk details (via, safety notes) for the walk route's expanded card. */
      walk: WalkingRoute | null;
    }
  | { status: 'error'; message: string };

const NO_VEHICLES: Record<Vehicle, boolean> = { car: false, bike: false, cycle: false };

/** Route cards shown on Routes (and logged as the request's options). */
export const MAX_SHOWN_ROUTES = 8;

/** What Routes displays: ranked for `priority`, own vehicles filtered, capped. */
export const shownRoutes = (
  routes: RankedRoute[],
  priority: Priority,
  vehicles: Record<Vehicle, boolean>,
) => rankRoutes(routes, priority, vehicles).slice(0, MAX_SHOWN_ROUTES);

const CURRENT: Endpoint = { kind: 'current' };
const LOCATION_WAIT_MS = 15000;

/** The user's position now, or as soon as the first fix arrives (null on timeout). */
function firstUserLocation(timeoutMs: number): Promise<LatLng | null> {
  const now = useMapStore.getState().userLocation;
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);
    const unsubscribe = useMapStore.subscribe((s) => {
      if (!s.userLocation) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(s.userLocation);
    });
  });
}
const newSessionToken = () => Crypto.randomUUID();

interface TripState {
  from: Endpoint;
  to: Place | null;
  /** Typing drafts; `null` = show the picked endpoint's name. */
  fromDraft: string | null;
  toDraft: string | null;
  routes: RoutesState;
  /** Routes ranking. Starts at the Profile default; changing it re-ranks locally. */
  priority: Priority;
  setPriority: (priority: Priority) => void;
  /** One Places session per search: keystrokes + the final details call. */
  sessionToken: string;

  setFromDraft: (text: string | null) => void;
  setToDraft: (text: string | null) => void;
  /** Resolve a suggestion to a place (ends the Places session). */
  resolve: (placeId: string) => Promise<Place>;
  pickFrom: (endpoint: Endpoint) => void;
  pickTo: (place: Place) => void;
  swap: () => void;
  clear: () => void;
  retry: () => void;
  /** Free text → best match (AI Mode, History "Repeat"). Resolves false if nothing matched. */
  plan: (to: string, from?: string) => Promise<boolean>;
}

/** Only the latest route request wins; older ones are aborted. */
let inflight: AbortController | null = null;
/** Set once the user picks a priority on Routes; until then it follows the Profile default. */
let priorityChosen = false;

/**
 * The trip being planned, shared by Home (search) and Routes (options): every
 * route option plus the safe-walk details.
 */
export const useTripStore = create<TripState>()((set, get) => {
  const compute = async (origin: Endpoint, destination: Place | null) => {
    inflight?.abort();
    if (!destination) {
      set({ routes: { status: 'idle' } });
      return;
    }
    const controller = new AbortController();
    inflight = controller;
    const { signal } = controller;
    set({ routes: { status: 'loading' } });
    // Right after launch the first GPS fix may not have arrived yet: wait for it.
    const start =
      origin.kind === 'place' ? origin.place.location : await firstUserLocation(LOCATION_WAIT_MS);
    if (controller.signal.aborted) return;
    if (!start) {
      set({
        routes: {
          status: 'error',
          message: 'Couldn’t get your location. Turn on location, or pick a From place.',
        },
      });
      return;
    }
    try {
      await useRoutlyPrefs.getState().hydrate();
      const vehicles = useRoutlyPrefs.getState().prefs?.vehicles ?? NO_VEHICLES;
      // getRoutes throws only when every mode failed; the walk is optional extra detail.
      const [result, walk] = await Promise.all([
        routingService.getRoutes(start, destination, {
          priority: get().priority,
          vehicles,
          signal,
        }),
        directionsService.walking(start, destination.location, { signal }).catch(() => null),
      ]);
      if (signal.aborted) return;
      const requestId = Crypto.randomUUID();
      const fromName =
        origin.kind === 'place'
          ? origin.place.name
          : (useMapStore.getState().area ?? 'Current location');
      // Once per result; priority changes re-rank locally and aren't logged.
      logRequest({
        id: requestId,
        at: new Date(),
        from: { name: fromName, location: start },
        to: { name: destination.name, location: destination.location },
        priority: get().priority,
        // Exactly what the user is shown, so ranks match the cards.
        routes: shownRoutes(result.routes, get().priority, vehicles),
      });
      set({
        routes: {
          status: 'ready',
          requestId,
          routes: result.routes,
          notices: result.notices,
          walk,
        },
      });
    } catch (e) {
      if (!signal.aborted) {
        set({
          routes: {
            status: 'error',
            message: e instanceof Error ? e.message : 'Couldn’t get routes.',
          },
        });
      }
    }
  };

  const bestMatch = async (text: string) => {
    const near = useMapStore.getState().userLocation ?? undefined;
    const [best] = await placesService.autocomplete(text, {
      sessionToken: get().sessionToken,
      near,
    });
    return best ? get().resolve(best.placeId) : null;
  };

  return {
    from: CURRENT,
    to: null,
    fromDraft: null,
    toDraft: null,
    routes: { status: 'idle' },
    priority: useRoutlyPrefs.getState().prefs?.defaultPriority ?? 'fastest',

    setPriority: (priority) => {
      priorityChosen = true;
      set({ priority });
    },
    sessionToken: newSessionToken(),

    setFromDraft: (fromDraft) => set({ fromDraft }),
    setToDraft: (toDraft) => set({ toDraft }),

    resolve: async (placeId) => {
      const place = await placesService.details(placeId, { sessionToken: get().sessionToken });
      set({ sessionToken: newSessionToken() });
      return place;
    },

    pickFrom: (from) => {
      set({ from, fromDraft: null });
      compute(from, get().to);
    },

    pickTo: (to) => {
      set({ to, toDraft: null });
      compute(get().from, to);
    },

    swap: () => {
      const { from, to } = get();
      // Current location can only be an origin: swapping it out leaves To empty.
      const nextFrom: Endpoint = to ? { kind: 'place', place: to } : CURRENT;
      const nextTo = from.kind === 'place' ? from.place : null;
      set({ from: nextFrom, to: nextTo, fromDraft: null, toDraft: null });
      compute(nextFrom, nextTo);
    },

    clear: () => {
      inflight?.abort();
      set({ from: CURRENT, to: null, fromDraft: null, toDraft: null, routes: { status: 'idle' } });
    },

    retry: () => compute(get().from, get().to),

    plan: async (toText, fromText) => {
      const to = await bestMatch(toText);
      if (!to) return false;
      const fromPlace = fromText ? await bestMatch(fromText) : null;
      const from: Endpoint = fromPlace ? { kind: 'place', place: fromPlace } : CURRENT;
      set({ from, to, fromDraft: null, toDraft: null });
      compute(from, to);
      return true;
    },
  };
});

/**
 * Follows Profile: the default priority until the user picks one on Routes,
 * and a refetch when the usable vehicles change during an active trip.
 */
useRoutlyPrefs.subscribe((state, prev) => {
  const prefs = state.prefs;
  if (!prefs) return;
  const trip = useTripStore.getState();
  if (!priorityChosen && prefs.defaultPriority !== trip.priority) {
    useTripStore.setState({ priority: prefs.defaultPriority });
  }
  const before = prev.prefs?.vehicles;
  const changed =
    before !== undefined &&
    (Object.keys(prefs.vehicles) as Vehicle[]).some((v) => before[v] !== prefs.vehicles[v]);
  if (changed && trip.to) trip.retry();
});
