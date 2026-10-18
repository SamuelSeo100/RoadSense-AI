import type { Leg, Route, TrafficLevel } from '@/services/types';
import { colors, type Mode } from '@/theme/routly';

/** The mode that characterises a route (first non-walking leg). */
export function primaryMode(route: Pick<Route, 'legs'>): Mode {
  return route.legs.find((l) => l.mode !== 'walk')?.mode ?? route.legs[0]?.mode ?? 'walk';
}

/**
 * Badge for the route marked `aiPick`. TODO(ml): back to "AI pick" once the
 * learned ranker (Feature 4) is live; today it's the v1 heuristic.
 */
export const TOP_PICK_LABEL = 'Top pick';

export const formatInr = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export const trafficTextColor: Record<TrafficLevel, string> = {
  Light: colors.traffic.textLight,
  Moderate: colors.traffic.textModerate,
  Heavy: colors.traffic.textHeavy,
};

export const formatWalking = (km: number) => (km === 0 ? 'None' : `${km} km`);
export const formatTransfers = (n: number) => (n === 0 ? 'Direct' : String(n));

/** "~8m" for estimated legs (straight-line auto / walk), "8m" otherwise. */
export const legMinutes = (leg: Pick<Leg, 'durationMin' | 'approximate'>) =>
  `${leg.approximate ? '~' : ''}${leg.durationMin}m`;

/** "16:48" → "4:48 PM", "00:10" → "12:10 AM" (timetable departures are stored 24 h). */
export function formatClock12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]) % 24;
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const MODE_NAMES: Record<Mode, string> = {
  walk: 'Walk',
  metro: 'Metro',
  bus: 'Bus',
  auto: 'Auto',
  cab: 'Cab',
  bike: 'Bike',
  cycle: 'Cycle',
  train: 'Train',
};

/** Short strip label: "Walk 6m", "Metro Aqua", "Bus 208B", "Auto ~8m". */
export function shortLegLabel(leg: Leg): string {
  if (leg.mode === 'metro' || leg.mode === 'train' || leg.mode === 'bus') {
    const label = leg.label.replace(/ Line$/, '');
    // "Bus · Swargate Depot" (no route number) is too long for the strip.
    return label.includes(' · ') ? MODE_NAMES[leg.mode] : label;
  }
  // First word of the label keeps own vehicles apart from hired ones ("Car", not "Cab").
  const name = leg.label.split(' ')[0] || MODE_NAMES[leg.mode];
  return `${name} ${legMinutes(leg)}`;
}

/** "~₹20" when the fare comes from a table not yet checked against the published chart. */
export const legCost = (leg: Pick<Leg, 'costInr' | 'fareEstimated'>) =>
  `${leg.fareEstimated ? '~' : ''}${formatInr(leg.costInr ?? 0)}`;

/**
 * "₹321–472" when the route's meta carries an estimate range (cabs), "~₹45"
 * when a leg's fare is unverified, else "₹396".
 */
export function routeCost(route: Pick<Route, 'costInr' | 'meta' | 'legs'>): string {
  const range = route.meta?.match(/₹[\d,]+–[\d,]+/);
  if (range) return range[0];
  return `${route.legs.some((l) => l.fareEstimated) ? '~' : ''}${formatInr(route.costInr)}`;
}

/** Below this the wait isn't worth a mention ("Next metro 8:14 AM"). */
const WAIT_NOTE_MIN = 5;

/**
 * "Next train 10:01 AM (waits 69 min)" for a timetable route's first ride,
 * so a long platform wait (already in the total time) is never hidden. Null
 * for routes without a scheduled departure.
 */
export function nextDepartureNote(route: Pick<Route, 'legs'>): string | null {
  const ride = route.legs.find(
    (l) => (l.mode === 'metro' || l.mode === 'train' || l.mode === 'bus') && l.departure,
  );
  if (!ride?.departure) return null;
  const wait =
    ride.waitMin !== undefined && ride.waitMin >= WAIT_NOTE_MIN
      ? ` (waits ${ride.waitMin} min)`
      : '';
  return `Next ${MODE_NAMES[ride.mode].toLowerCase()} ${formatClock12(ride.departure)}${wait}`;
}
