import { useEffect, useState } from 'react';

import { placesService, type LatLng, type PlaceSuggestion } from '@/services';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

interface AutocompleteState {
  query: string;
  suggestions: PlaceSuggestion[];
  failed: boolean;
}

/**
 * Debounced place suggestions for `query`. Each keystroke cancels the
 * previous timer and in-flight request; repeated queries come from the
 * service's cache. Disabled (no requests) when `enabled` is false.
 */
export function usePlaceAutocomplete(
  query: string,
  { enabled, sessionToken, near }: { enabled: boolean; sessionToken: string; near: LatLng | null },
) {
  const [state, setState] = useState<AutocompleteState>({
    query: '',
    suggestions: [],
    failed: false,
  });
  const q = query.trim();
  // ~1 km precision: GPS jitter doesn't restart the search.
  const nearLat = near ? Math.round(near.latitude * 100) / 100 : null;
  const nearLng = near ? Math.round(near.longitude * 100) / 100 : null;
  const active = enabled && q.length >= MIN_CHARS;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const bias =
        nearLat !== null && nearLng !== null
          ? { latitude: nearLat, longitude: nearLng }
          : undefined;
      placesService
        .autocomplete(q, { sessionToken, near: bias, signal: controller.signal })
        .then((suggestions) =>
          setState({ query: q, suggestions: suggestions.slice(0, 5), failed: false }),
        )
        .catch(() => {
          if (!controller.signal.aborted) setState({ query: q, suggestions: [], failed: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, q, sessionToken, nearLat, nearLng]);

  const current = active && state.query === q;
  return {
    suggestions: current ? state.suggestions : [],
    loading: active && !current,
    failed: current && state.failed,
  };
}
