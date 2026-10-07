import type { RoutePriority } from '@/constants/routePriorities';

import type { Priority } from '../types';

const toDb: Record<Priority, RoutePriority> = {
  fastest: 'fastest',
  cheapest: 'cheapest',
  walking: 'least_walking',
  transfers: 'fewest_transfers',
};

/**
 * App priority → the DB vocabulary (profiles.priority, route_requests.priority,
 * route_choices.priority and the keys of options[].score; all CHECK-constrained
 * to these 4 values). The only place this mapping lives: every write uses it.
 */
export function toDbPriority(priority: Priority): RoutePriority {
  return toDb[priority];
}
