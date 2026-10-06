import { Linking, Platform } from 'react-native';

import { env } from '@/lib/env';

import type { LatLng } from './types';

export type BookingProvider = 'uber' | 'ola' | 'rapido' | 'puneMetro' | 'pmpml';

export const bookingProviderNames: Record<BookingProvider, string> = {
  uber: 'Uber',
  ola: 'Ola',
  rapido: 'Rapido',
  puneMetro: 'Pune Metro tickets',
  pmpml: 'PMPML bus pass',
};

export interface BookingTrip {
  pickup?: LatLng;
  drop?: LatLng & { name?: string };
}

const playStore = (pkg: string) => `https://play.google.com/store/apps/details?id=${pkg}`;

function query(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/**
 * Candidate URLs per provider, best first. Only documented formats are used:
 * - Uber universal link (developer.uber.com › Deep links): opens the app when
 *   installed, otherwise m.uber.com in the browser.
 * - Ola web deep link (developers.olacabs.com/docs/deep-linking): India-only,
 *   hands off to the app; needs an XAPP token as `utm_source`.
 * - Rapido, Pune Metro, PMPML publish no deep-link spec, so their store page or
 *   website opens instead (the store shows "Open" when the app is installed).
 */
function urlsFor(provider: BookingProvider, trip: BookingTrip): string[] {
  const { pickup, drop } = trip;
  switch (provider) {
    case 'uber':
      return [
        `https://m.uber.com/ul/?${query({
          action: 'setPickup',
          client_id: env.uberClientId,
          pickup: pickup ? undefined : 'my_location',
          'pickup[latitude]': pickup?.latitude,
          'pickup[longitude]': pickup?.longitude,
          'dropoff[latitude]': drop?.latitude,
          'dropoff[longitude]': drop?.longitude,
          'dropoff[nickname]': drop?.name,
        })}`,
      ];
    case 'ola':
      return [
        ...(env.olaXappToken
          ? [
              `https://book.olacabs.com/?${query({
                utm_source: env.olaXappToken,
                lat: pickup?.latitude,
                lng: pickup?.longitude,
                drop_lat: drop?.latitude,
                drop_lng: drop?.longitude,
              })}`,
            ]
          : []),
        Platform.OS === 'android'
          ? playStore('com.olacabs.customer')
          : 'https://apps.apple.com/in/app/ola-book-cab-auto-bike-taxi/id539179365',
      ];
    case 'rapido':
      return [
        Platform.OS === 'android' ? playStore('com.rapido.passenger') : 'https://www.rapido.bike',
      ];
    case 'puneMetro':
      return [
        Platform.OS === 'android'
          ? playStore('org.mahametro.punemobileapp')
          : 'https://apps.apple.com/in/app/pune-metro-official-app/id1571012648',
        'https://www.punemetrorail.org',
      ];
    case 'pmpml':
      return [
        Platform.OS === 'android' ? playStore('in.chartr.pmpml') : 'https://www.pmpml.org',
        'https://www.pmpml.org',
      ];
  }
}

/**
 * Redirects to the provider (no in-app booking). Tries each candidate URL in
 * turn; resolves false if none could be opened.
 */
export async function openBooking(provider: BookingProvider, trip: BookingTrip = {}) {
  for (const url of urlsFor(provider, trip)) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next fallback.
    }
  }
  return false;
}
