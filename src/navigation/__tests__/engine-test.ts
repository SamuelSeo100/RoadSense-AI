import { describe, expect, it } from '@jest/globals';

import { NavigationEngine, type NavEvent } from '../engine';

import { at, fix, step } from '../__fixtures__/helpers';

const types = (events: NavEvent[]) => events.map((e) => e.type);

describe('step advance', () => {
  const steps = () => [
    step({ polyline: [at(0), at(300)], distanceM: 300 }),
    step({ polyline: [at(300), at(300, 300)], distanceM: 300 }),
  ];

  it('moves to the next step within 20 m of the end, warning ~100 m before the turn', () => {
    const engine = new NavigationEngine(steps(), at(300, 300));
    expect(types(engine.start(0))).toEqual(['stepStart']);
    expect(engine.update(fix(at(150), 10))).toEqual([]);
    expect(types(engine.update(fix(at(210), 20)))).toEqual(['approachTurn']);
    expect(engine.update(fix(at(275), 30))).toEqual([]); // 25 m out
    const events = engine.update(fix(at(285), 40));
    expect(events).toMatchObject([{ type: 'stepStart', index: 1 }]);
    expect(engine.index).toBe(1);
  });

  it('uses 35 m when accuracy is worse than 25 m', () => {
    const coarse = new NavigationEngine(steps(), at(300, 300));
    coarse.start(0);
    expect(types(coarse.update(fix(at(270), 5, { accuracy: 30 })))).toContain('stepStart');
    const fine = new NavigationEngine(steps(), at(300, 300));
    fine.start(0);
    expect(types(fine.update(fix(at(270), 5, { accuracy: 10 })))).not.toContain('stepStart');
  });

  it('skips through several tiny steps on one fix', () => {
    const engine = new NavigationEngine(
      [
        step({ polyline: [at(0), at(5)] }),
        step({ polyline: [at(5), at(10)] }),
        step({ polyline: [at(10), at(400)], distanceM: 390 }),
      ],
      at(400),
    );
    engine.start(0);
    engine.update(fix(at(2), 1));
    expect(engine.index).toBe(2);
  });
});

describe('off route', () => {
  const walk = () =>
    new NavigationEngine([step({ polyline: [at(0), at(1000)], distanceM: 1000 })], at(1000));

  it('fires after 15 s continuously more than 50 m from a walk', () => {
    const engine = walk();
    engine.start(0);
    expect(engine.update(fix(at(100, 80), 0))).toEqual([]);
    expect(engine.update(fix(at(120, 80), 10))).toEqual([]);
    expect(types(engine.update(fix(at(140, 80), 15)))).toEqual(['offRoute', 'reroute']);
    expect(engine.offRouteCount).toBe(1);
    // Still off: no repeat.
    expect(engine.update(fix(at(160, 80), 20))).toEqual([]);
  });

  it('starts the 15 s again after coming back', () => {
    const engine = walk();
    engine.start(0);
    engine.update(fix(at(100, 80), 0));
    engine.update(fix(at(110, 10), 10)); // back on the path
    expect(engine.update(fix(at(120, 80), 14))).toEqual([]);
    expect(engine.update(fix(at(130, 80), 25))).toEqual([]);
    expect(types(engine.update(fix(at(140, 80), 29)))).toContain('offRoute');
  });

  it('allows 100 m on road steps', () => {
    const engine = new NavigationEngine(
      [step({ kind: 'drive', legMode: 'auto', polyline: [at(0), at(3000)], distanceM: 3000 })],
      at(3000),
    );
    engine.start(0);
    for (let t = 0; t <= 60; t += 5)
      expect(engine.update(fix(at(100 + t * 10, 80), t))).toEqual([]);
    expect(types(engine.update(fix(at(800, 130), 65)))).toEqual([]);
    expect(types(engine.update(fix(at(850, 130), 80)))).toContain('offRoute');
  });

  it('never fires during a ride', () => {
    const engine = new NavigationEngine(
      [
        step({
          kind: 'transit',
          legMode: 'metro',
          polyline: [at(0), at(5000)],
          distanceM: 5000,
          transit: {
            mode: 'metro',
            line: 'Metro Purple Line',
            boardStop: 'A',
            alightStop: 'B',
            stopCount: 4,
          },
        }),
      ],
      at(9000),
    );
    engine.start(0);
    for (let t = 0; t <= 120; t += 5) {
      expect(types(engine.update(fix(at(1000, 2000), t)))).not.toContain('offRoute');
    }
    expect(engine.offRouteCount).toBe(0);
  });
});

describe('rides', () => {
  const stops = [at(0), at(1000), at(2000), at(3000)];
  const ride = (withStops: boolean) =>
    new NavigationEngine(
      [
        step({
          kind: 'transit',
          legMode: 'metro',
          polyline: stops,
          distanceM: 3000,
          transit: {
            mode: 'metro',
            line: 'Metro Purple Line',
            boardStop: 'A',
            alightStop: 'Swargate',
            stopCount: 3,
            stopsLatLng: withStops ? stops : undefined,
          },
        }),
        step({ polyline: [at(3000), at(3000, 400)], distanceM: 400 }),
      ],
      at(3000, 400),
    );

  it('detects boarding above 15 km/h along the line', () => {
    const engine = ride(true);
    engine.start(0);
    expect(engine.update(fix(at(0), 60, { speed: 1 }))).toEqual([]);
    expect(engine.update(fix(at(50), 120, { speed: 8 }))).toMatchObject([
      { type: 'boarded', t: 120_000 },
    ]);
    expect(engine.history[0]?.boardedAt).toBe(120_000);
  });

  it('says "get off at the next stop" once past the stop before', () => {
    const engine = ride(true);
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(1500), 100, { speed: 10 })))).toEqual([]);
    expect(engine.update(fix(at(1920), 150, { speed: 10 }))).toMatchObject([
      { type: 'alightSoon', stop: 'Swargate' },
    ]);
    expect(engine.update(fix(at(2300), 180, { speed: 10 }))).toEqual([]); // once
  });

  it('uses 600 m before the end when the stops are unknown', () => {
    const engine = ride(false);
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(engine.update(fix(at(2300), 150, { speed: 10 }))).toEqual([]); // 700 m
    expect(types(engine.update(fix(at(2420), 160, { speed: 10 })))).toEqual(['alightSoon']);
  });

  it('ends the ride near the alighting station and starts the walk', () => {
    const engine = ride(true);
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(2900), 300, { speed: 2 })))).toEqual(['stepStart']);
    expect(engine.current?.kind).toBe('walk');
  });

  it('includes the wait for a scheduled departure in the arrival time', () => {
    const engine = new NavigationEngine(
      [
        step({
          kind: 'transit',
          legMode: 'train',
          polyline: [at(0), at(20_000)],
          distanceM: 20_000,
          predictedDurationS: 1800,
          transit: {
            mode: 'train',
            line: 'local train',
            boardStop: 'Shivaji Nagar',
            alightStop: 'Lonavala',
            stopCount: 15,
            scheduledDep: new Date(3_600_000).toISOString(),
          },
        }),
      ],
      at(20_000),
    );
    engine.start(0);
    expect(engine.remaining(0).arrivalAt).toBe(3_600_000 + 1_800_000);
  });
});

describe('reroute rate limit', () => {
  it('asks at most once per 30 s, and counts the reroutes applied', () => {
    const line = () => [step({ polyline: [at(0), at(2000)], distanceM: 2000 })];
    const engine = new NavigationEngine(line(), at(2000));
    engine.start(0);
    engine.update(fix(at(100, 80), 0));
    expect(types(engine.update(fix(at(100, 80), 15)))).toEqual(['offRoute', 'reroute']);
    // The route call failed: retry allowed, but not before 30 s after the last ask.
    engine.rerouteFailed();
    expect(engine.update(fix(at(100, 80), 30))).toEqual([]);
    expect(types(engine.update(fix(at(100, 80), 45)))).toEqual(['reroute']);
    expect(engine.rerouteCount).toBe(0);

    // New route still misses us: off-route again after 15 s, reroute only once 30 s have passed.
    expect(types(engine.replaceSteps(line(), 46_000))).toEqual(['stepStart']);
    expect(engine.rerouteCount).toBe(1);
    engine.update(fix(at(100, 80), 47));
    expect(types(engine.update(fix(at(100, 80), 62)))).toEqual(['offRoute']);
    expect(types(engine.update(fix(at(100, 80), 75)))).toEqual(['reroute']);
    expect(engine.offRouteCount).toBe(2);
    expect(engine.history[0]).toMatchObject({ version: 0, interrupted: true, endedAt: 46_000 });
  });
});

describe('off route: accuracy and reroute cap', () => {
  const walk = () =>
    new NavigationEngine([step({ polyline: [at(0), at(5000)], distanceM: 5000 })], at(5000));

  it('ignores fixes less accurate than 50 m', () => {
    const engine = walk();
    engine.start(0);
    for (let t = 0; t <= 60; t += 5) {
      expect(engine.update(fix(at(100 + t, 80), t, { accuracy: 60 }))).toEqual([]);
    }
    // A poor fix neither starts nor clears an episode.
    engine.update(fix(at(200, 80), 70, { accuracy: 20 }));
    engine.update(fix(at(200, 10), 78, { accuracy: 80 })); // "back on route", but untrusted
    expect(types(engine.update(fix(at(210, 80), 85, { accuracy: 50 })))).toEqual([
      'offRoute',
      'reroute',
    ]);
  });

  it('computes at most 5 reroutes per trip, then only reports off route', () => {
    const engine = walk();
    engine.start(0);
    const reroutes: number[] = [];
    // Seven off-route episodes, 40 s apart, back on the route in between.
    for (let n = 0; n < 7; n++) {
      const t0 = n * 40;
      engine.update(fix(at(100, 0), t0 - 1));
      engine.update(fix(at(100, 80), t0));
      const events = engine.update(fix(at(100, 80), t0 + 15));
      expect(types(events)[0]).toBe('offRoute');
      if (types(events).includes('reroute')) {
        reroutes.push(n);
        engine.rerouteFailed();
      }
    }
    expect(reroutes).toEqual([0, 1, 2, 3, 4]);
    expect(engine.rerouteLimitReached).toBe(true);
    expect(engine.offRouteCount).toBe(7);
    // Still off for minutes: no more requests.
    for (let t = 300; t <= 400; t += 10) {
      expect(types(engine.update(fix(at(100, 80), t)))).not.toContain('reroute');
    }
  });
});

describe('arrival', () => {
  it('arrives within 50 m of the destination, whatever the step', () => {
    const engine = new NavigationEngine(
      [
        step({ polyline: [at(0), at(500)], distanceM: 500 }),
        step({ polyline: [at(500), at(1000)], distanceM: 500 }),
      ],
      at(1000),
    );
    engine.start(0);
    expect(types(engine.update(fix(at(940), 60)))).toEqual([]);
    expect(engine.update(fix(at(960), 70))).toEqual([{ type: 'arrived', t: 70_000 }]);
    expect(engine.status).toBe('arrived');
    expect(engine.update(fix(at(1000), 80))).toEqual([]);
    expect(engine.history[engine.history.length - 1]?.endedAt).toBe(70_000);
  });
});
