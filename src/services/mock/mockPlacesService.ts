import type { PlacesService } from '../types';

import { mockData } from './mockData';

/** Offline stand-in when no Google key is configured: searches the sample places. */
export function createMockPlacesService(): PlacesService {
  return {
    async autocomplete(input) {
      const q = input.trim().toLowerCase();
      return mockData.places
        .filter((p) => p.name.toLowerCase().includes(q) || p.area?.toLowerCase().includes(q))
        .map((p) => ({ placeId: p.id, primary: p.name, secondary: p.area }));
    },
    async details(placeId) {
      const place = mockData.places.find((p) => p.id === placeId);
      if (!place) throw new Error('Place not found.');
      return place;
    },
  };
}
