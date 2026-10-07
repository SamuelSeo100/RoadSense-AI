import { rankRoutes } from '../ranking';
import type { LatLng, Place, Route, RoutingService } from '../types';

import { bendFor, placeFor, toLatLng, withGeometry } from './geometry';
import { mockData } from './mockData';

/** Simulated network latency, so loading states are visible. */
const LATENCY_MS = 450;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withPaths = (routes: Route[], from: Place | LatLng, to: Place): Route[] =>
  routes.map((r, i) => ({
    ...r,
    legs: withGeometry(r.legs, toLatLng(from), to.location, bendFor(i)),
  }));

export function createMockRoutingService(): RoutingService {
  return {
    async getRoutes(from, to, { priority, vehicles }) {
      await delay(LATENCY_MS);
      return {
        routes: rankRoutes(withPaths(mockData.routes, from, to), priority, vehicles),
        notices: [],
      };
    },

    async getPreview(from, to) {
      await delay(LATENCY_MS);
      return withPaths(mockData.homePreview, from, to);
    },

    async searchPlaces(query) {
      const q = query.trim().toLowerCase();
      if (!q) return mockData.places;
      return mockData.places.filter(
        (p) => p.name.toLowerCase().includes(q) || p.area?.toLowerCase().includes(q),
      );
    },

    async geocode(name) {
      return name.trim() ? placeFor(name) : null;
    },
  };
}
