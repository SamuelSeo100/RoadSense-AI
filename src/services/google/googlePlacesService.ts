import { LruCache } from '../lruCache';
import type { LatLng, Place, PlaceSuggestion, PlacesService } from '../types';

import { googleRequest } from './googleClient';

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
}

interface DetailsResponse {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: LatLng;
}

/** Bias results to ~30 km around the user (city-scale). */
const BIAS_RADIUS_M = 30000;

/** Places API (New): autocomplete + details, with session tokens and caching. */
export function createGooglePlacesService(): PlacesService {
  const suggestionCache = new LruCache<string, PlaceSuggestion[]>(60);
  const placeCache = new LruCache<string, Place>(60);

  return {
    async autocomplete(input, { sessionToken, near, signal }) {
      // Bias rounded to ~1 km, so small GPS moves still hit the cache.
      const biasKey = near ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}` : '';
      const key = `${input.trim().toLowerCase()}|${biasKey}`;
      const cached = suggestionCache.get(key);
      if (cached) return cached;

      const res = await googleRequest<AutocompleteResponse>(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          signal,
          fieldMask:
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
          body: {
            input,
            sessionToken,
            languageCode: 'en',
            includedRegionCodes: ['in'],
            ...(near ? { locationBias: { circle: { center: near, radius: BIAS_RADIUS_M } } } : {}),
          },
        },
      );
      const suggestions = (res.suggestions ?? []).flatMap(({ placePrediction: p }) =>
        p
          ? [
              {
                placeId: p.placeId,
                primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
                secondary: p.structuredFormat?.secondaryText?.text,
              },
            ]
          : [],
      );
      suggestionCache.set(key, suggestions);
      return suggestions;
    },

    async details(placeId, { sessionToken, signal }) {
      const cached = placeCache.get(placeId);
      if (cached) return cached;
      const res = await googleRequest<DetailsResponse>(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
        { method: 'GET', signal, fieldMask: 'id,displayName,formattedAddress,location' },
      );
      if (!res.location) throw new Error('This place has no location.');
      const place: Place = {
        id: res.id,
        name: res.displayName?.text ?? res.formattedAddress ?? 'Selected place',
        area: res.formattedAddress,
        location: res.location,
      };
      placeCache.set(placeId, place);
      return place;
    },
  };
}
