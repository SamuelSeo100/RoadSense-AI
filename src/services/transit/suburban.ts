import { pathKm, slabFare, suburbanNetwork, valueOf } from './network';
import { parseHHMM } from './time';
import type { SuburbanDirection, SuburbanNetwork } from './types';

export interface SuburbanDeparture {
  trainNo: string;
  direction: SuburbanDirection;
  /**
   * Minutes after midnight of the query day: may exceed 1440 (a train after
   * midnight) and is never before `time`.
   */
  departure: number;
  arrival: number;
  waitMin: number;
  rideMin: number;
  fromIndex: number;
  toIndex: number;
  /** Chainage km when known, else straight-line km between stations. */
  km: number | null;
  fare: { fare: number; verified: boolean } | null;
}

/** Distance for the fare: chainage when both ends have it, else straight line along stations. */
function tripKm(network: SuburbanNetwork, from: number, to: number): number | null {
  const a = valueOf(network.stations[from]?.km);
  const b = valueOf(network.stations[to]?.km);
  if (a !== null && b !== null) return Math.abs(b - a);
  return pathKm(network.stations, from, to);
}

/**
 * Next scheduled train that stops at both stations, in that order, leaving
 * `from` at or after `time` (minutes after IST midnight) on `dayOfWeek`
 * (0 = Sunday). Looks at trips that started yesterday (still running after
 * midnight), today and tomorrow, each on its own days of operation. Null
 * when none leaves within `maxWaitMin`.
 */
export function nextSuburbanDeparture(
  fromId: string,
  toId: string,
  time: number,
  dayOfWeek: number,
  { maxWaitMin = Infinity }: { maxWaitMin?: number } = {},
  network: SuburbanNetwork = suburbanNetwork,
): SuburbanDeparture | null {
  const fromIndex = network.stations.findIndex((s) => s.id === fromId);
  const toIndex = network.stations.findIndex((s) => s.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;

  let best: Omit<SuburbanDeparture, 'km' | 'fare'> | null = null;
  for (const dayShift of [-1, 0, 1]) {
    const serviceDay = (((dayOfWeek + dayShift) % 7) + 7) % 7;
    for (const trip of network.trips) {
      if (!trip.days.includes(serviceDay)) continue;
      const dep = parseHHMM(trip.times[fromIndex]);
      const arr = parseHHMM(trip.times[toIndex]);
      if (dep === null || arr === null || arr <= dep) continue;
      const departure = dep + dayShift * 1440;
      if (departure < time - 1e-9 || departure - time > maxWaitMin) continue;
      if (best && departure >= best.departure) continue;
      best = {
        trainNo: trip.trainNo,
        direction: trip.direction,
        departure,
        arrival: arr + dayShift * 1440,
        waitMin: departure - time,
        rideMin: arr - dep,
        fromIndex,
        toIndex,
      };
    }
  }
  if (!best) return null;
  const km = tripKm(network, fromIndex, toIndex);
  return { ...best, km, fare: km === null ? null : slabFare(network.fares.slabs, km) };
}
