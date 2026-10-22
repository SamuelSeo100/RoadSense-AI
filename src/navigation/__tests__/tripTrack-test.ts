import { describe, expect, it } from '@jest/globals';

import { NavigationEngine } from '../engine';
import { buildTripTrack, TrackRecorder } from '../tripTrack';

import { at, fix, step } from '../__fixtures__/helpers';

describe('TrackRecorder', () => {
  it('keeps one point per 15 s, rounded to 5 decimals', () => {
    const rec = new TrackRecorder(0);
    for (let t = 0; t <= 60; t += 5) rec.add(fix({ latitude: 18.123456789, longitude: 73.9 }, t));
    expect(rec.points.map((p) => p.s)).toEqual([0, 15, 30, 45, 60]);
    expect(rec.points[0]).toEqual({ s: 0, lat: 18.12346, lng: 73.9, acc: 8 });
  });
});

describe('buildTripTrack', () => {
  const steps = [
    step({ polyline: [at(0), at(200)], distanceM: 200, predictedDurationS: 150, legIndex: 0 }),
    step({
      kind: 'transit',
      legMode: 'metro',
      source: 'routly_timetable',
      polyline: [at(200), at(3200)],
      distanceM: 3000,
      predictedDurationS: 300,
      legIndex: 1,
      transit: {
        mode: 'metro',
        line: 'Metro Purple',
        boardStop: 'A',
        alightStop: 'B',
        stopCount: 3,
        scheduledDep: '2026-10-19T02:44:00.000Z',
      },
    }),
    step({
      polyline: [at(3200), at(3200, 300)],
      distanceM: 300,
      predictedDurationS: 240,
      legIndex: 2,
    }),
  ];

  it('records predicted vs actual per leg, the platform wait and arrival', () => {
    const engine = new NavigationEngine(steps, at(3200, 300));
    engine.start(0);
    engine.update(fix(at(190), 180)); // at the station after 3 min
    engine.update(fix(at(260), 420, { speed: 9 })); // boards 4 min later
    engine.update(fix(at(3150), 760, { speed: 1 })); // closest to the alighting stop
    engine.update(fix(at(3200, 100), 790, { speed: 1 })); // walking away: got off at 760
    engine.update(fix(at(3200, 270), 1000)); // arrived
    const row = buildTripTrack({
      id: 'track-1',
      tripId: 'trip-1',
      routeSource: 'routly_timetable',
      startedAt: 0,
      endedAt: 1_000_000,
      endReason: 'arrived',
      predictedDurationS: 900,
      predictedFare: 25.4,
      rerouteCount: engine.rerouteCount,
      offRouteCount: engine.offRouteCount,
      stepsByVersion: [steps],
      history: engine.history,
      trackPoints: null,
    });
    expect(row).toMatchObject({
      trip_id: 'trip-1',
      completed: true,
      end_reason: 'arrived',
      actual_duration_s: 1000,
      predicted_fare: 25,
      track_points: null,
    });
    expect(row.legs).toEqual([
      expect.objectContaining({ leg_index: 0, kind: 'walk', predicted_s: 150, actual_s: 180 }),
      expect.objectContaining({
        leg_index: 1,
        kind: 'transit',
        mode: 'metro',
        line: 'Metro Purple',
        source: 'routly_timetable',
        predicted_s: 300,
        actual_s: 580,
        scheduled_dep: '2026-10-19T02:44:00.000Z',
        actual_start: new Date(180_000).toISOString(),
        actual_end: new Date(760_000).toISOString(),
        actual_board_time: new Date(420_000).toISOString(),
        actual_alight_time: new Date(760_000).toISOString(),
        wait_s: 240,
        ended_by: 'gps',
      }),
      expect.objectContaining({
        leg_index: 2,
        predicted_s: 240,
        actual_s: 210,
        actual_start: new Date(790_000).toISOString(),
        ended_by: 'gps',
      }),
    ]);
  });

  it('marks a leg ended with "Next leg" as manual, with no alight time', () => {
    const engine = new NavigationEngine(steps, at(3200, 300));
    engine.start(0);
    engine.update(fix(at(190), 180));
    engine.skipLeg(300_000); // no GPS on the ride: skipped by hand
    const row = buildTripTrack({
      id: 'm',
      tripId: 'trip',
      routeSource: 'routly_timetable',
      startedAt: 0,
      endedAt: 400_000,
      endReason: 'user_ended',
      predictedDurationS: 900,
      predictedFare: 0,
      rerouteCount: 0,
      offRouteCount: 0,
      stepsByVersion: [steps],
      history: engine.history,
      trackPoints: null,
    });
    expect(row.legs[1]).toMatchObject({
      leg_index: 1,
      actual_s: 120,
      actual_end: new Date(300_000).toISOString(),
      actual_alight_time: null,
      ended_by: 'manual',
    });
  });

  it('keeps the started legs of a rerouted route and leaves unfinished ones without a time', () => {
    const engine = new NavigationEngine(steps, at(3200, 300));
    engine.start(0);
    const rerouted = [
      step({ polyline: [at(100, 100), at(3200, 300)], distanceM: 3200, legIndex: 0 }),
    ];
    engine.replaceSteps(rerouted, 60_000);
    const row = buildTripTrack({
      id: 'x',
      tripId: 'trip',
      routeSource: 'google',
      startedAt: 0,
      endedAt: 90_000,
      endReason: 'user_ended',
      predictedDurationS: 900,
      predictedFare: 0,
      rerouteCount: engine.rerouteCount,
      offRouteCount: 1,
      stepsByVersion: [steps, rerouted],
      history: engine.history,
      trackPoints: [],
    });
    expect(row.completed).toBe(false);
    expect(row.reroute_count).toBe(1);
    expect(row.legs.map((l) => [l.version, l.leg_index, l.actual_s])).toEqual([
      [0, 0, null],
      [1, 0, null],
    ]);
  });
});
