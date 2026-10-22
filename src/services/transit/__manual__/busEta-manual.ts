/**
 * Manual bus ETA check against the live Google Routes API (costs API calls; not
 * part of `npm test`):
 *
 *   node --env-file=.env node_modules/.bin/jest --config src/services/transit/__manual__/jest.config.js --runInBand busEta-manual
 *
 * For each trip: the top 3 ranked routes, what every bus leg would show (arrival
 * at the stop, ride range, source badge), and the Google calls before / after
 * the traffic calls. Departures in the future get Google's predicted traffic,
 * "now" gets live traffic.
 */
import { describe, it, jest } from '@jest/globals';

import type { BusEta } from '../../busEta';
import type { Place, Priority } from '../../types';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'in.routly.app' } } },
}));

const place = (name: string, latitude: number, longitude: number): Place => ({
  id: name,
  name,
  location: { latitude, longitude },
});

const P = {
  swargate: place('Swargate', 18.5018, 73.8636),
  hinjewadi: place('Hinjewadi Phase 1', 18.5913, 73.7389),
  kothrud: place('Kothrud', 18.5039, 73.8128),
  puneJn: place('Pune Jn', 18.5289, 73.8742),
  hadapsar: place('Hadapsar', 18.5089, 73.926),
  shivajinagar: place('Shivajinagar', 18.5308, 73.8475),
  pimpri: place('Pimpri', 18.6279, 73.8009),
};

/** Next day at `hhmm` IST. */
function tomorrow(hhmm: string): Date {
  const ist = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
  return new Date(`${ist}T${hhmm}:00+05:30`);
}

const TRIPS: [Place, Place, Date | undefined, Priority][] = [
  [P.swargate, P.hinjewadi, undefined, 'fastest'],
  [P.kothrud, P.puneJn, tomorrow('14:00'), 'fastest'],
  [P.pimpri, P.swargate, tomorrow('21:30'), 'cheapest'],
  // No bus in the top 3: no traffic calls.
  [P.hadapsar, P.shivajinagar, tomorrow('22:15'), 'fastest'],
];

const BADGE = { scheduled_traffic: 'Scheduled + traffic', scheduled: 'Scheduled' } as const;
function range(low: number, high: number): string {
  const lo = Math.round(low);
  const hi = Math.max(lo, Math.round(high));
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}
function shown(eta: BusEta, now: number): string {
  const low = (eta.departLowAt - now) / 60_000;
  const high = (eta.departHighAt - now) / 60_000;
  const arrives =
    high < 1
      ? 'may have left your stop'
      : low < 1
        ? `due at stop within ~${Math.round(high)} min`
        : `arrives at stop in ~${range(low, high)} min`;
  const factor = eta.trafficFactor === null ? '' : ` ×${eta.trafficFactor.toFixed(2)}`;
  return `${arrives} · ride ~${range(eta.rideLowMin, eta.rideHighMin)} min (sched ${Math.round(eta.scheduledRideMin)}${factor}, ${eta.hourBand}) [${BADGE[eta.source]}]`;
}

const run = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? describe : describe.skip;

run('manual bus ETA', () => {
  it('prints bus legs of the top 3 routes per trip', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createGoogleRoutingService } =
      require('../../google/googleRoutingService') as typeof import('../../google/googleRoutingService');
    const { createGoogleDirectionsService } =
      require('../../google/googleDirectionsService') as typeof import('../../google/googleDirectionsService');
    const { createMockSafetyService } =
      require('../../mock/mockSafetyService') as typeof import('../../mock/mockSafetyService');
    const { googleCallCount } =
      require('../../google/googleClient') as typeof import('../../google/googleClient');
    const { fetchBusTrafficRatio } =
      require('../../google/googleBusTraffic') as typeof import('../../google/googleBusTraffic');
    const {
      busEtaConfig,
      busLegKey,
      busLegOf,
      createBusEtaService,
      estimateBusLeg,
      routeDurationRange,
    } = require('../../busEta') as typeof import('../../busEta');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const routing = createGoogleRoutingService({
      directions: createGoogleDirectionsService(createMockSafetyService()),
      preferences: {
        get: async () => ({ defaultPriority: 'fastest' }) as never,
        update: async () => ({}) as never,
      },
      places: { searchPlaces: async () => [], geocode: async () => null },
    });
    const etas = createBusEtaService(fetchBusTrafficRatio);
    const lines: string[] = [];
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    for (const [from, to, departAt, priority] of TRIPS) {
      const now = departAt?.getTime() ?? Date.now();
      lines.push(
        `\n## ${from.name} → ${to.name} (${priority}) @ IST ${new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      );
      try {
        const before = googleCallCount();
        const res = await routing.getRoutes(from, to, {
          priority,
          vehicles: { car: false, bike: false, cycle: false },
          departAt,
        });
        const searchCalls = googleCallCount() - before;
        const top = res.routes.slice(0, busEtaConfig.topRoutes);
        const buses = new Map(
          top
            .flatMap((r) => r.legs.flatMap((l) => busLegOf(l) ?? []))
            .map((b) => [busLegKey(b), b]),
        );
        const factors = new Map(
          await Promise.all(
            [...buses].map(async ([key, b]) => [key, await etas.trafficFactor(b)] as const),
          ),
        );
        const etaCalls = googleCallCount() - before - searchCalls;
        for (const r of top) {
          const total = routeDurationRange(r, (b) => factors.get(busLegKey(b)) ?? null);
          const card = total
            ? `card ${total.lowMin}–${total.highMin} min (scheduled ${r.durationMin})`
            : `card ${r.durationMin} min`;
          lines.push(`  #${r.rank} ${r.name}: ${card}`);
          for (const l of r.legs) {
            const b = busLegOf(l);
            if (!b) continue;
            const eta = estimateBusLeg(b, factors.get(busLegKey(b)) ?? null);
            lines.push(`     ${l.label} · ${b.fromStop} → ${b.toStop}: ${shown(eta, now)}`);
          }
        }
        if (buses.size === 0) lines.push('  (no bus legs in the top 3: no traffic calls)');
        lines.push(
          `  Google calls: search ${searchCalls}, bus ETA +${etaCalls} (${buses.size} distinct bus legs)`,
        );
      } catch (e) {
        lines.push(`  ERROR ${String(e)}`);
      }
    }
    info.mockRestore();
    process.stdout.write(lines.join('\n') + '\n');
  }, 120_000);
});
