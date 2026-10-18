/**
 * Manual OD check against the live Google Routes API (costs API calls; not
 * part of `npm test`):
 *
 *   node --env-file=.env node_modules/.bin/jest --config src/services/transit/__manual__/jest.config.js --runInBand
 *
 * (Not an npm script on purpose: package.json scripts are part of the Expo
 * fingerprint, so adding one would make OTA updates miss installed builds.)
 *
 * Prints every ranked option (rank, source, time, fare, legs) and the Google
 * calls per request. ROUTLY_OD_ONLY="Kothrud → Lonavala" runs only matching pairs.
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

const P = {
  pimpri: place('Pimpri', 18.6279, 73.8009),
  swargate: place('Swargate', 18.5018, 73.8636),
  kothrud: place('Kothrud', 18.5039, 73.8128),
  kalyaniNagar: place('Kalyani Nagar', 18.5463, 73.9033),
  akurdi: place('Akurdi', 18.6486, 73.7647),
  puneJn: place('Pune Jn', 18.5289, 73.8742),
  lonavala: place('Lonavala', 18.7537, 73.4086),
};

/** Monday 2026-10-19 (IST). */
const at = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00+05:30`);

const ODS: [Place, Place, Date][] = [
  [P.pimpri, P.swargate, at('08:30')],
  [P.kothrud, P.kalyaniNagar, at('08:30')],
  [P.kothrud, P.pimpri, at('08:30')],
  [P.akurdi, P.puneJn, at('08:30')],
  [P.kothrud, P.lonavala, at('08:30')],
  // 08:30: the next Lonavala local from Shivaji Nagar is 10:01 (~70 min wait, shown); 07:20 catches UP-06.
  [P.kothrud, P.lonavala, at('07:20')],
  [P.pimpri, P.swargate, at('22:30')],
  [P.puneJn, P.lonavala, at('23:55')],
];

function describeRoute(r: RankedRoute): string {
  const legs = r.legs
    .map((l) => {
      const cost = l.costInr ? ` ${l.fareEstimated ? '~' : ''}₹${l.costInr}` : '';
      const sched = l.realtime === false ? ` [Scheduled dep ${l.departure}]` : '';
      const stops = l.from && l.to ? ` ${l.from}→${l.to}` : '';
      return `${l.label}${stops} ${l.durationMin}m${cost}${sched}`;
    })
    .join(' › ');
  return `#${r.rank} (heur ${r.heuristicRank}) ${r.source.padEnd(16)} ${String(r.durationMin).padStart(3)} min ₹${r.costInr} ${r.walkingKm} km walk ${r.transfers} tr | ${legs}`;
}

const run = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? describe : describe.skip;

run('manual OD', () => {
  it('prints ranked options per OD', async () => {
    // require, not import(): after the mocks above (no ESM dynamic import under Jest here).
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createGoogleRoutingService } =
      require('../../google/googleRoutingService') as typeof import('../../google/googleRoutingService');
    const { createGoogleDirectionsService } =
      require('../../google/googleDirectionsService') as typeof import('../../google/googleDirectionsService');
    const { createMockSafetyService } =
      require('../../mock/mockSafetyService') as typeof import('../../mock/mockSafetyService');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const service = createGoogleRoutingService({
      directions: createGoogleDirectionsService(createMockSafetyService()),
      preferences: {
        get: async () => ({ defaultPriority: 'fastest' }) as never,
        update: async () => ({}) as never,
      },
      places: { searchPlaces: async () => [], geocode: async () => null },
    });
    const lines: string[] = [];
    const info = jest.spyOn(console, 'info').mockImplementation((msg: unknown) => {
      lines.push(`  ${String(msg)}`);
    });
    const only = process.env.ROUTLY_OD_ONLY;
    for (const [from, to, departAt] of ODS) {
      if (only && !`${from.name} → ${to.name}`.includes(only)) continue;
      lines.push(
        `\n## ${from.name} → ${to.name} @ ${departAt.toISOString()} (IST ${departAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })})`,
      );
      try {
        const res = await service.getRoutes(from, to, {
          priority: 'fastest',
          vehicles: { car: false, bike: false, cycle: false },
          departAt,
        });
        if (res.notices.length) lines.push(`  notices: ${JSON.stringify(res.notices)}`);
        for (const r of res.routes) lines.push(`  ${describeRoute(r)}`);
      } catch (e) {
        lines.push(`  ERROR ${String(e)}`);
      }
    }
    info.mockRestore();
    process.stdout.write(lines.join('\n') + '\n');
  }, 120_000);
});
