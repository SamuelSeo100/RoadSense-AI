import { LruCache } from '../lruCache';
import type { LatLng, Place, PlaceSuggestion, PlacesService, ReverseGeocodeResult } from '../types';

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

interface GeocodeResponse {
  results?: {
    placeId?: string;
    types?: string[];
    addressComponents?: { longText?: string; types?: string[] }[];
  }[];
}

/**
 * Geocoding API v4 (beta): it takes the key in X-Goog-Api-Key with the app
 * headers like the other Google calls (the legacy endpoint needs ?key=).
 */
const GEOCODE_URL = 'https://geocode.googleapis.com/v4beta/geocode/location';

/** Address results we name a point after (never a business / point of interest). */
const ADDRESS_TYPES = ['premise', 'subpremise', 'street_address', 'route'];
/** Not a name: postcodes ("411014"), house numbers, plus codes ("HW97+5P6"). */
const isJunk = (text: string) => /^[\d\s/-]+$/.test(text) || text.includes('+');

/**
 * "Vishwananda Apartment, Nehru Nagar": building (premise) or street, plus
 * the most specific neighbourhood. Falls back to the neighbourhood alone,
 * then "Pinned location". Results come nearest first.
 */
export function nameFromGeocode(res: GeocodeResponse): ReverseGeocodeResult {
  type Result = NonNullable<GeocodeResponse['results']>[number];
  const results = res.results ?? [];
  const textOf = (r: Result | undefined, type: string) =>
    r?.addressComponents?.find((c) => c.types?.includes(type) && c.longText && !isJunk(c.longText))
      ?.longText;
  const lead = (r: Result) => textOf(r, 'premise') ?? textOf(r, 'subpremise') ?? textOf(r, 'route');
  // The nearest address result that names a building or street ("premise" is
  // sometimes just the postcode, so fall through to the next result).
  const named = results.find((r) => r.types?.some((t) => ADDRESS_TYPES.includes(t)) && lead(r));
  const base = named ?? results.find((r) => r.types?.some((t) => ADDRESS_TYPES.includes(t)));
  // Components run from specific to general: the first sublocality is the most local.
  const area = textOf(base ?? results[0], 'sublocality');
  const first = named ? lead(named) : undefined;
  const name = first && area ? `${first}, ${area}` : (first ?? area ?? 'Pinned location');
  return { name, placeId: (base ?? results[0])?.placeId ?? null };
}

/** Bias results to ~30 km around the user (city-scale). */
const BIAS_RADIUS_M = 30000;

/** Places API (New): autocomplete + details, with session tokens and caching. */
export function createGooglePlacesService(): PlacesService {
  const suggestionCache = new LruCache<string, PlaceSuggestion[]>(60);
  const placeCache = new LruCache<string, Place>(60);
  /** ~11 m cells: panning back to a spot doesn't geocode again. */
  const geocodeCache = new LruCache<string, ReverseGeocodeResult>(60);

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

    async reverseGeocode(at, opts) {
      const key = `${at.latitude.toFixed(4)},${at.longitude.toFixed(4)}`;
      const cached = geocodeCache.get(key);
      if (cached) return cached;
      const res = await googleRequest<GeocodeResponse>(
        `${GEOCODE_URL}/${at.latitude},${at.longitude}?languageCode=en`,
        {
          method: 'GET',
          signal: opts?.signal,
          fieldMask: 'results.placeId,results.types,results.addressComponents',
        },
      );
      const result = nameFromGeocode(res);
      geocodeCache.set(key, result);
      return result;
    },
  };
}
