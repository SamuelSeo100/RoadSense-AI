import type { IconName } from '@/components/ui/Icon';

/** What the ML ranker optimises for. Stored on the user's profile as `priority`. */
export const ROUTE_PRIORITIES = [
  'cheapest',
  'fastest',
  'least_walking',
  'fewest_transfers',
] as const;
export type RoutePriority = (typeof ROUTE_PRIORITIES)[number];

export const routePriorityInfo: Record<RoutePriority, { label: string; icon: IconName }> = {
  cheapest: { label: 'Cheapest', icon: 'currency-rupee' },
  fastest: { label: 'Fastest', icon: 'bolt' },
  least_walking: { label: 'Least walking', icon: 'directions-walk' },
  fewest_transfers: { label: 'Fewest transfers', icon: 'alt-route' },
};
