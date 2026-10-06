import type { HistoryService } from '../types';

import { placeFor, withGeometry } from './geometry';
import { mockData } from './mockData';

export function createMockHistoryService(): HistoryService {
  return {
    async getTrips() {
      return mockData.trips.map((trip, i) => {
        const [leg] = withGeometry(
          [{ mode: trip.mode, label: trip.modeLabel, durationMin: trip.durationMin }],
          placeFor(trip.from).location,
          placeFor(trip.to).location,
          i % 2 ? 0.12 : -0.08,
        );
        return { ...trip, path: leg?.polyline };
      });
    },
    async getMonthlyStats() {
      return mockData.monthlyStats;
    },
  };
}
