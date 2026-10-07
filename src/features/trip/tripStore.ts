import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import {
  directionsService,
  placesService,
  type LatLng,
  type Place,
  type WalkingRoute,
} from '@/services';

import { useMapStore } from '../map/mapStore';

/** From is either the live GPS position or a searched place. */
export type Endpoint = { kind: 'current' } | { kind: 'place'; place: Place };

export type RouteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; route: WalkingRoute }
  | { status: 'error'; message: string };

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
  route: RouteState;
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

/**
 * The trip being planned, shared by Home (search) and Routes (options). For
 * now the only option fetched is walking.
 */
export const useTripStore = create<TripState>()((set, get) => {
  const compute = async (origin: Endpoint, destination: Place | null) => {
    inflight?.abort();
    if (!destination) {
      set({ route: { status: 'idle' } });
      return;
    }
    const controller = new AbortController();
    inflight = controller;
    set({ route: { status: 'loading' } });
    // Right after launch the first GPS fix may not have arrived yet: wait for it.
    const start =
      origin.kind === 'place' ? origin.place.location : await firstUserLocation(LOCATION_WAIT_MS);
    if (controller.signal.aborted) return;
    if (!start) {
      set({
        route: {
          status: 'error',
          message: 'Couldn’t get your location. Turn on location, or pick a From place.',
        },
      });
      return;
    }
    try {
      const route = await directionsService.walking(start, destination.location, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) set({ route: { status: 'ready', route } });
    } catch (e) {
      if (!controller.signal.aborted) {
        set({
          route: {
            status: 'error',
            message: e instanceof Error ? e.message : 'Couldn’t get directions.',
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
    route: { status: 'idle' },
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
      set({ from: CURRENT, to: null, fromDraft: null, toDraft: null, route: { status: 'idle' } });
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
