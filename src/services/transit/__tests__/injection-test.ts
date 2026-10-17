import { describe, expect, it } from '@jest/globals';

import type { Draft, DraftLeg } from '../../google/googleRoutingService';
import type { LatLng } from '../../types';
import { metroFixture, suburbanFixture, trip } from '../__fixtures__/networks';
import {
  applyMetroTable,
  dropDominated,
  stationSignature,
  timetableDrafts,
  type FetchAccess,
} from '../injection';
import { haversineKm } from '../network';

/** Monday 2026-10-19 at `hhmm` IST. */
const ist = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00+05:30`);

function fakeAccess() {
  const calls: { mode: string; km: number }[] = [];
  const fetchAccess: FetchAccess = async (a: LatLng, b: LatLng, mode) => {
    const km = haversineKm(a, b) * 1.3;
    calls.push({ mode, km });
    const min = mode === 'walk' ? (km / 4.8) * 60 : 3 + (km / 20) * 60;
    return { mode, durationSec: min * 60, distanceM: km * 1000, path: [a, b], approximate: false };
  };
  return { calls, fetchAccess };
}

const emptySuburban = suburbanFixture([]);
// ~0.33 km south of A1 / B4 respectively.
const nearA1 = { latitude: 18.497, longitude: 73.8 };
const nearB4 = { latitude: 18.477, longitude: 73.82 };

describe('timetableDrafts', () => {
  it('builds access + ride + interchange + egress options with at most 2 + 2 calls', async () => {
    const { calls, fetchAccess } = fakeAccess();
    const drafts = await timetableDrafts({
      from: nearA1,
      to: nearB4,
      at: ist('07:00'),
      fetchAccess,
      maxWaitMin: 45,
      metro: metroFixture(),
      suburban: emptySuburban,
    });
    expect(calls.length).toBeLessThanOrEqual(4);
    expect(drafts.length).toBeGreaterThan(0);
    const best = [...drafts].sort((a, b) => a.durationSec - b.durationSec)[0]!;
    expect(best.source).toBe('routly_timetable');
    expect(best.legs.map((l) => l.mode)).toEqual(['walk', 'metro', 'walk', 'metro', 'walk']);
    const [, m1, change, m2] = best.legs as DraftLeg[];
    expect([m1!.fromStop, m1!.toStop, m2!.fromStop, m2!.toStop]).toEqual(['A1', 'A3', 'B2', 'B4']);
    expect(change!.durationSec).toBe(4 * 60); // interchange walk only
    expect(m1).toMatchObject({ realtime: false, fareInr: 15, lineColor: '#123456' });
    expect(m2!.fareInr).toBe(0); // one journey fare
    expect(m1!.departure).toMatch(/^07:\d\d$/);
    // Door to door ≥ access + ride.
    expect(best.durationSec).toBeGreaterThan(best.rideSec - 1);
  });

  it('uses an auto for stations further than 1.2 km', async () => {
    const { calls, fetchAccess } = fakeAccess();
    // 2 km west of A1: A1 is the nearest entry.
    const far = { latitude: 18.5, longitude: 73.781 };
    const drafts = await timetableDrafts({
      from: far,
      to: nearB4,
      at: ist('07:00'),
      fetchAccess,
      maxWaitMin: 45,
      metro: metroFixture(),
      suburban: emptySuburban,
    });
    expect(calls[0]?.mode).toBe('auto');
    expect(drafts.some((d) => d.legs[0]?.mode === 'auto' && d.legs[0].label === 'Auto to A1')).toBe(
      true,
    );
  });

  it('makes no calls and no options when no train runs (late night, long wait)', async () => {
    for (const at of [ist('23:45'), ist('04:30')]) {
      const { calls, fetchAccess } = fakeAccess();
      const drafts = await timetableDrafts({
        from: nearA1,
        to: nearB4,
        at,
        fetchAccess,
        maxWaitMin: 45,
        metro: metroFixture(),
        suburban: emptySuburban,
      });
      expect(drafts).toEqual([]);
      expect(calls).toEqual([]);
    }
  });

  it('adds local train options from imported trips', async () => {
    const { fetchAccess } = fakeAccess();
    const suburban = suburbanFixture([
      trip('99801', ['07:20', '07:28', '07:35', '07:42', '07:50']),
    ]);
    const drafts = await timetableDrafts({
      from: { latitude: 18.6, longitude: 73.601 },
      to: { latitude: 18.6, longitude: 73.799 },
      at: ist('07:00'),
      fetchAccess,
      maxWaitMin: 45,
      metro: metroFixture(),
      suburban,
    });
    const train = drafts.find((d) => d.legs.some((l) => l.mode === 'train'));
    expect(train?.legs.find((l) => l.mode === 'train')).toMatchObject({
      label: 'Train 99801',
      fromStop: 'S0',
      toStop: 'S4',
      fareInr: 15,
      realtime: false,
      departure: '07:20',
    });
  });
});

describe('dropDominated', () => {
  it('drops options worse on time, cost and walking, keeps trade-offs', () => {
    const fast = { id: 'fast', durationMin: 30, costInr: 40, walkingKm: 0.5 };
    const cheap = { id: 'cheap', durationMin: 45, costInr: 20, walkingKm: 0.8 };
    const worse = { id: 'worse', durationMin: 50, costInr: 40, walkingKm: 1 };
    const same = { ...fast, id: 'same' };
    expect(dropDominated([fast, cheap, worse, same]).map((r) => r.id)).toEqual([
      'fast',
      'cheap',
      'same',
    ]);
  });
});

const googleMetroDraft = (legs: Partial<DraftLeg>[]): Draft => ({
  legs: legs.map((l) => ({
    mode: 'walk',
    durationSec: 60,
    distanceM: 100,
    path: [],
    approximate: false,
    ...l,
  })),
  durationSec: 1800,
  rideSec: 1700,
  googleFareInr: null,
  transitUnchanged: true,
  source: 'google',
});

describe('Google metro legs (bundled Pune data)', () => {
  it('keep Google timing but take our fare and line colour', () => {
    const draft = googleMetroDraft([
      {},
      {
        mode: 'metro',
        label: 'Metro Purple Line',
        fromStop: 'PCMC',
        toStop: 'Kasba Peth',
        stops: 10,
        durationSec: 1200,
      },
      {},
    ]);
    const out = applyMetroTable(draft);
    expect(out.legs[1]).toMatchObject({
      fareInr: 25,
      fareEstimated: true,
      lineColor: '#903373',
      durationSec: 1200,
    });
    expect(draft.legs[1]?.fareInr).toBeUndefined(); // input untouched
  });

  it('price an interchange as one journey', () => {
    const out = applyMetroTable(
      googleMetroDraft([
        { mode: 'metro', label: 'Metro Aqua Line', fromStop: 'Vanaz', toStop: 'District Court' },
        {},
        {
          mode: 'metro',
          label: 'Metro Purple Line',
          fromStop: 'Civil Court',
          toStop: 'PCMC Metro Station',
        },
      ]),
    );
    // 8 + 9 = 17 stations → top slab.
    expect(out.legs.map((l) => l.fareInr)).toEqual([35, undefined, 0]);
  });

  it('match Google stop names with other spellings', () => {
    const out = applyMetroTable(
      googleMetroDraft([
        {
          mode: 'metro',
          label: 'Metro Purple Line',
          fromStop: 'Shivaji Nagar Metro Station',
          toStop: 'Mahatma Phule Mandai',
        },
      ]),
    );
    // Shivajinagar → Civil Court → Budhwar Peth → Mandai = 3 stations.
    expect(out.legs[0]?.fareInr).toBe(10);
  });

  it('leave unknown lines on the fares.ts estimate', () => {
    const out = applyMetroTable(
      googleMetroDraft([{ mode: 'metro', label: 'Metro Blue', fromStop: 'X', toStop: 'Y' }]),
    );
    expect(out.legs[0]?.fareInr).toBeUndefined();
  });

  it('match a timetable option to the same Google option (near-duplicate)', () => {
    const google = googleMetroDraft([
      {},
      { mode: 'metro', label: 'Metro Purple Line', fromStop: 'PCMC', toStop: 'Kasba Peth' },
      {},
      {},
    ]);
    const ours: Draft = {
      ...googleMetroDraft([
        {},
        { mode: 'metro', label: 'Metro Purple Line', fromStop: 'PCMC', toStop: 'Budhwar Peth' },
        {},
      ]),
      source: 'routly_timetable',
    };
    expect(stationSignature(ours)).toBe(stationSignature(google));
    expect(stationSignature(ours)).toBe('walk|metro:pcmc>budhwarpeth|walk');
  });
});
