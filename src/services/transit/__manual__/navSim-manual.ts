/**
 * Manual navigation check: real routes (live Google Routes API + our metro /
 * train timetables; costs API calls, not part of `npm test`) replayed through
 * the navigation engine by the demo simulator at 4×, headless:
 *
 *   node --env-file=.env node_modules/.bin/jest --config src/services/transit/__manual__/jest.config.js --runInBand navSim-manual
 *
 * Prints per trip: the legs, every engine event with the simulated clock, the
 * cards' next-leg / transfer / stops-left text, and the trip_tracks legs.
 */
import { describe, it, jest } from '@jest/globals';

import type { Place, RankedRoute } from '../../types';

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

/** Next day at `hhmm` IST. */
function tomorrow(hhmm: string): Date {
  const ist = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
  return new Date(`${ist}T${hhmm}:00+05:30`);
}

const TRIPS: {
  label: string;
  from: Place;
  to: Place;
  at: Date;
  mode: 'bus' | 'metro' | 'train';
}[] = [
  {
    label: 'bus',
    from: place('Kothrud', 18.5039, 73.8128),
    to: place('Pune Jn', 18.5289, 73.8742),
    at: tomorrow('14:00'),
    mode: 'bus',
  },
  {
    label: 'metro',
    from: place('Pimpri', 18.6279, 73.8009),
    to: place('Swargate', 18.5018, 73.8636),
    at: tomorrow('09:00'),
    mode: 'metro',
  },
  {
    label: 'local train',
    from: place('Pune Jn', 18.5289, 73.8742),
    to: place('Lonavala', 18.7537, 73.4086),
    at: tomorrow('07:30'),
    mode: 'train',
  },
];

const run = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? describe : describe.skip;

run('manual navigation simulation', () => {
  it('replays a bus, a metro and a local-train trip at 4×', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createGoogleRoutingService } =
      require('../../google/googleRoutingService') as typeof import('../../google/googleRoutingService');
    const { createGoogleDirectionsService } =
      require('../../google/googleDirectionsService') as typeof import('../../google/googleDirectionsService');
    const { createMockSafetyService } =
      require('../../mock/mockSafetyService') as typeof import('../../mock/mockSafetyService');
    const { NavigationEngine } =
      require('../../../navigation/engine') as typeof import('../../../navigation/engine');
    const { routeToSteps, formatDistance } =
      require('../../../navigation/steps') as typeof import('../../../navigation/steps');
    const { simulatedFix, simulationPlan, planDurationS } =
      require('../../../navigation/simulate') as typeof import('../../../navigation/simulate');
    const { nextLegPreview, stopsRemaining, transferText } =
      require('../../../navigation/legView') as typeof import('../../../navigation/legView');
    const { buildTripTrack } =
      require('../../../navigation/tripTrack') as typeof import('../../../navigation/tripTrack');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const routing = createGoogleRoutingService({
      directions: createGoogleDirectionsService(createMockSafetyService()),
      preferences: {
        get: async () => ({ defaultPriority: 'fastest' }) as never,
        update: async () => ({}) as never,
      },
      places: { searchPlaces: async () => [], geocode: async () => null },
    });
    const lines: string[] = [];
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const SPEED = 4;
    const mmss = (ms: number) =>
      `${String(Math.floor(ms / 60_000)).padStart(2, '0')}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;

    for (const trip of TRIPS) {
      lines.push(`\n## ${trip.label}: ${trip.from.name} → ${trip.to.name}`);
      const { routes } = await routing.getRoutes(trip.from, trip.to, {
        priority: 'fastest',
        vehicles: { car: false, bike: false, cycle: false },
        departAt: trip.at,
      });
      const route: RankedRoute | undefined = routes.find((r) =>
        r.legs.some((l) => l.mode === trip.mode),
      );
      if (!route) {
        lines.push(`  no ${trip.mode} route returned`);
        continue;
      }
      lines.push(
        `  route #${route.rank} ${route.name} (${route.source}), ${route.durationMin} min: ${route.legs.map((l) => l.label).join(' › ')}`,
      );
      const steps = routeToSteps(route, trip.to);
      const plan = simulationPlan(steps, trip.to.location);
      const engine = new NavigationEngine(steps, trip.to.location);
      const t0 = 0;
      const log = (t: number, text: string) => lines.push(`  [${mmss(t - t0)}] ${text}`);
      const onEvents = (events: ReturnType<typeof engine.update>, t: number) => {
        for (const e of events) {
          if (e.type === 'stepStart') {
            const s = e.step;
            const legStart =
              engine.allSteps.findIndex((x) => x.legIndex === s.legIndex) === e.index;
            if (!legStart && s.kind !== 'transit') continue; // turn-by-turn inside a leg
            const transfer = transferText(engine.allSteps, e.index);
            const next = nextLegPreview(engine.allSteps, e.index, trip.to.name);
            log(t, `leg ${s.legIndex} ${s.transit?.mode ?? s.legMode}: ${s.instruction}`);
            if (transfer) log(t, `   transfer: ${transfer}`);
            if (next) log(t, `   next: ${next.text}`);
          } else if (e.type === 'boarded') log(t, `boarded`);
          else if (e.type === 'alightSoon' || e.type === 'stopNext') {
            const s = engine.current!;
            const left = stopsRemaining(
              s,
              { latitude: plan[0]!.p.latitude, longitude: plan[0]!.p.longitude },
              engine.progressM,
            );
            log(
              t,
              `${e.type === 'alightSoon' ? 'GET OFF SOON' : 'YOUR STOP IS NEXT'}: ${e.stop} (${formatDistance(engine.legRemaining().distanceM)} left${left?.estimated ? `, ~${left.count} stops` : ''})`,
            );
          } else if (e.type === 'offRoute') log(t, `off route (${Math.round(e.distanceM)} m)`);
          else if (e.type === 'arrived') log(t, 'ARRIVED');
        }
      };
      onEvents(engine.start(t0), t0);
      let simS = 0;
      let t = t0;
      while (engine.status === 'navigating' && simS < planDurationS(plan) + 600) {
        simS += SPEED;
        t += 1000;
        onEvents(engine.update(simulatedFix(plan, simS, t)), t);
      }
      lines.push(
        `  status ${engine.status} after ${mmss(t - t0)} real (${Math.round(simS / 60)} min simulated), off-route ${engine.offRouteCount}`,
      );
      const track = buildTripTrack({
        id: 'sim',
        tripId: 'sim',
        routeSource: route.source,
        startedAt: t0,
        endedAt: t,
        endReason: engine.status === 'arrived' ? 'arrived' : 'user_ended',
        predictedDurationS: route.durationMin * 60,
        predictedFare: route.costInr,
        rerouteCount: 0,
        offRouteCount: engine.offRouteCount,
        stepsByVersion: [steps],
        history: engine.history,
        trackPoints: null,
      });
      for (const l of track.legs) {
        lines.push(
          `  track leg ${l.leg_index} ${l.mode}: ${l.actual_s ?? '–'} s (${l.ended_by ?? 'unfinished'})${l.actual_board_time ? `, board +${(Date.parse(l.actual_board_time) - t0) / 1000} s` : ''}${l.actual_alight_time ? `, alight +${(Date.parse(l.actual_alight_time) - t0) / 1000} s` : ''}`,
        );
      }
    }
    info.mockRestore();
    process.stdout.write(lines.join('\n') + '\n');
  }, 180_000);
});
