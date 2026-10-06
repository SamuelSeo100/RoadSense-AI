import type { Route, TrafficLevel } from '@/services/types';
import { colors, type Mode } from '@/theme/routly';

/** The mode that characterises a route (first non-walking leg). */
export function primaryMode(route: Pick<Route, 'legs'>): Mode {
  return route.legs.find((l) => l.mode !== 'walk')?.mode ?? route.legs[0]?.mode ?? 'walk';
}

export const formatInr = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export const trafficTextColor: Record<TrafficLevel, string> = {
  Light: colors.traffic.textLight,
  Moderate: colors.traffic.textModerate,
  Heavy: colors.traffic.textHeavy,
};

export const formatWalking = (km: number) => (km === 0 ? 'None' : `${km} km`);
export const formatTransfers = (n: number) => (n === 0 ? 'Direct' : String(n));
