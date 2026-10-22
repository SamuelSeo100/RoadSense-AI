import type { FetchTrafficRatio } from '../busEta';

import { googleRequest } from './googleClient';

/** Only the two durations: the cheapest response that gives a traffic ratio. */
const TRAFFIC_MASK = 'routes.duration,routes.staticDuration';

interface TrafficResponse {
  routes?: { duration?: string; staticDuration?: string }[];
}

const seconds = (d?: string) => Number.parseInt(d ?? '0', 10) || 0;

/**
 * One TRAFFIC_AWARE DRIVE call between a bus leg's stops: duration / staticDuration
 * (> 1 when the road is slower than usual). Null when Google has no route.
 */
export const fetchBusTrafficRatio: FetchTrafficRatio = async (from, to, at) => {
  const res = await googleRequest<TrafficResponse>(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      fieldMask: TRAFFIC_MASK,
      body: {
        origin: { location: { latLng: from } },
        destination: { location: { latLng: to } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        // Predicted traffic for a later bus (the API rejects past times).
        ...(at.getTime() > Date.now() + 60_000 ? { departureTime: at.toISOString() } : {}),
      },
    },
  );
  const route = res.routes?.[0];
  const duration = seconds(route?.duration);
  const staticDuration = seconds(route?.staticDuration);
  return duration > 0 && staticDuration > 0 ? duration / staticDuration : null;
};
