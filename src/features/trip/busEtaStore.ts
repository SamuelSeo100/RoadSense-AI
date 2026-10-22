import { useMemo } from 'react';
import { create } from 'zustand';

import {
  busEtaConfig,
  busEtaService,
  busLegKey,
  busLegOf,
  estimateBusLeg,
  type BusEta,
  type BusLeg,
  type Leg,
  type Route,
} from '@/services';

interface BusEtaState {
  /** Traffic factor per bus (busLegKey); null = unavailable. Absent: schedule only. */
  factors: Record<string, number | null>;
  /** Buses whose traffic call is in flight. */
  pending: Record<string, true>;
}

export const useBusEtaStore = create<BusEtaState>()(() => ({ factors: {}, pending: {} }));

/**
 * Traffic calls, in parallel, for the bus legs of the top ranked routes (each bus
 * once, however many routes share it). Never blocks: the list is already on screen
 * with schedule-only times, and each leg updates as its call returns.
 */
export function requestBusEtas(ranked: Pick<Route, 'legs'>[]) {
  const legs = new Map<string, BusLeg>();
  for (const route of ranked.slice(0, busEtaConfig.topRoutes)) {
    for (const leg of route.legs) {
      const bus = busLegOf(leg);
      if (bus) legs.set(busLegKey(bus), bus);
    }
  }
  const { factors, pending } = useBusEtaStore.getState();
  for (const [key, bus] of legs) {
    if (key in factors || pending[key]) continue;
    useBusEtaStore.setState((s) => ({ pending: { ...s.pending, [key]: true } }));
    void busEtaService.trafficFactor(bus).then((factor) =>
      useBusEtaStore.setState((s) => {
        const { [key]: _done, ...stillPending } = s.pending;
        return { factors: { ...s.factors, [key]: factor }, pending: stillPending };
      }),
    );
  }
}

/** The estimate as shown right now (schedule-only until its traffic factor is in). */
export function currentBusEta(bus: BusLeg): BusEta {
  return estimateBusLeg(bus, useBusEtaStore.getState().factors[busLegKey(bus)] ?? null);
}

/** The leg's ETA, updating when its traffic call returns; null for non-bus legs. */
export function useBusEta(leg: Leg): { eta: BusEta; pending: boolean } | null {
  const bus = useMemo(() => busLegOf(leg), [leg]);
  const key = bus ? busLegKey(bus) : null;
  const factor = useBusEtaStore((s) => (key === null ? null : (s.factors[key] ?? null)));
  const pending = useBusEtaStore((s) => key !== null && s.pending[key] === true);
  return useMemo(
    () => (bus ? { eta: estimateBusLeg(bus, factor), pending } : null),
    [bus, factor, pending],
  );
}
