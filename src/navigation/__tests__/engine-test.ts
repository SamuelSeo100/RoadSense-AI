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

describe('off route near stations', () => {
  it('not while walking out of the station the ride ended at', () => {
    const engine = new NavigationEngine(
      [
        step({
          kind: 'transit',
          legMode: 'train',
          polyline: [at(-5000), at(0)],
          transit: { mode: 'train', line: 'local', boardStop: 'A', alightStop: 'B', stopCount: 3 },
        }),
        // Google's walk starts 250 m from our station coordinate.
        step({ legIndex: 1, polyline: [at(250, 0), at(250, 600)], distanceM: 600 }),
      ],
      at(250, 600),
    );
    engine.start(0);
    engine.skipLeg(0);
    for (let t = 1; t <= 60; t += 5)
      expect(types(engine.update(fix(at(t * 2, 20), t)))).not.toContain('offRoute');
    expect(engine.offRouteCount).toBe(0);
  });
});

describe('off route', () => {
  const walk = () =>
    new NavigationEngine([step({ polyline: [at(0), at(1000)], distanceM: 1000 })], at(1000));

  it('fires after 20 s continuously more than 60 m from a walk, without rerouting', () => {
    const engine = walk();
    engine.start(0);
    expect(engine.update(fix(at(100, 55), 0))).toEqual([]); // 55 m: within 60
    expect(engine.update(fix(at(100, 80), 1))).toEqual([]);
    expect(engine.update(fix(at(120, 80), 15))).toEqual([]);
    expect(types(engine.update(fix(at(140, 80), 21)))).toEqual(['offRoute']);
    expect(engine.offRoute).toBe(true);
    expect(engine.offRouteCount).toBe(1);
    // Still off: no repeat, and never a reroute on its own.
    expect(engine.update(fix(at(160, 80), 60))).toEqual([]);
    expect(engine.rerouteCount).toBe(0);
  });

  it('starts the 20 s again after coming back', () => {
    const engine = walk();
    engine.start(0);
    engine.update(fix(at(100, 80), 0));
    engine.update(fix(at(110, 10), 10)); // back on the path
    expect(engine.offRoute).toBe(false);
    expect(engine.update(fix(at(120, 80), 14))).toEqual([]);
    expect(engine.update(fix(at(130, 80), 30))).toEqual([]);
    expect(types(engine.update(fix(at(140, 80), 34)))).toContain('offRoute');
  });

  it('allows 100 m on own-vehicle road steps', () => {
    const engine = new NavigationEngine(
      [
        step({
          kind: 'drive',
          legMode: 'cab',
          ownVehicle: true,
          polyline: [at(0), at(3000)],
          distanceM: 3000,
        }),
      ],
      at(3000),
    );
    engine.start(0);
    for (let t = 0; t <= 60; t += 5)
      expect(engine.update(fix(at(100 + t * 10, 80), t))).toEqual([]);
    expect(types(engine.update(fix(at(800, 130), 65)))).toEqual([]);
    expect(types(engine.update(fix(at(850, 130), 85)))).toContain('offRoute');
  });

  it('never fires in a hired auto or cab (the driver picks the way)', () => {
    const engine = new NavigationEngine(
      [step({ kind: 'drive', legMode: 'auto', polyline: [at(0), at(3000)], distanceM: 3000 })],
      at(3000),
    );
    engine.start(0);
    for (let t = 0; t <= 120; t += 5)
      expect(engine.update(fix(at(100 + t * 5, 400), t))).toEqual([]);
    expect(engine.offRouteCount).toBe(0);
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

  it('says "get off soon" 900 m out on a metro, not at the station before', () => {
    const engine = ride(true);
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(2050), 150, { speed: 10 })))).toEqual([]); // past the one before
    expect(engine.update(fix(at(2150), 160, { speed: 10 }))).toMatchObject([
      { type: 'alightSoon', stop: 'Swargate' },
    ]);
    expect(engine.update(fix(at(2300), 180, { speed: 10 }))).toEqual([]); // once
  });

  it('arriving from the vehicle records the alight time', () => {
    const engine = new NavigationEngine(
      [
        step({
          kind: 'transit',
          legMode: 'bus',
          polyline: [at(0), at(3000)],
          transit: { mode: 'bus', line: 'Bus 94', boardStop: 'A', alightStop: 'B', stopCount: 9 },
        }),
        step({ legIndex: 1, polyline: [at(3000), at(2900, 30)], distanceM: 110 }),
      ],
      at(2900, 30),
    );
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(2900), 300, { speed: 6 })))).toContain('arrived');
    expect(engine.history[0]).toMatchObject({ alightedAt: 300_000, endedAt: 300_000 });
  });

  it('ends the ride once near the alighting stop and moving away; alight time = closest', () => {
    const engine = ride(true);
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(2900), 300, { speed: 5 })))).not.toContain('stepStart');
    engine.update(fix(at(2995), 320, { speed: 0 })); // at the stop (closest)
    expect(engine.current?.kind).toBe('transit');
    expect(engine.update(fix(at(3000, 20), 340, { speed: 1 }))).toEqual([]); // 20 m away
    expect(types(engine.update(fix(at(3000, 45), 360, { speed: 1 })))).toEqual(['stepStart']);
    expect(engine.current?.kind).toBe('walk');
    expect(engine.history[0]).toMatchObject({
      boardedAt: 10_000,
      alightedAt: 320_000,
      endedAt: 320_000,
    });
    expect(engine.history[1]?.startedAt).toBe(360_000);
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

describe('reroute on request', () => {
  it('only when asked, at most once per 30 s, from the last fix', () => {
    const line = () => [step({ polyline: [at(0), at(2000)], distanceM: 2000 })];
    const engine = new NavigationEngine(line(), at(2000));
    engine.start(0);
    expect(engine.requestReroute(0)).toBeNull(); // no fix yet
    engine.update(fix(at(100, 80), 0));
    expect(types(engine.update(fix(at(100, 80), 20)))).toEqual(['offRoute']);
    expect(engine.requestReroute(20_000)).toEqual(at(100, 80));
    // The route call failed: allowed again 30 s after the last ask.
    expect(engine.canReroute(40_000)).toBe(false);
    expect(engine.requestReroute(40_000)).toBeNull();
    expect(engine.requestReroute(50_000)).not.toBeNull();
    expect(engine.rerouteCount).toBe(0);

    expect(types(engine.replaceSteps(line(), 51_000))).toEqual(['stepStart']);
    expect(engine.rerouteCount).toBe(1);
    expect(engine.offRoute).toBe(false);
    engine.update(fix(at(100, 80), 52));
    expect(types(engine.update(fix(at(100, 80), 72)))).toEqual(['offRoute']);
    expect(engine.offRouteCount).toBe(2);
    expect(engine.history[0]).toMatchObject({ version: 0, interrupted: true, endedAt: 51_000 });
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
    expect(types(engine.update(fix(at(210, 80), 90, { accuracy: 50 })))).toEqual(['offRoute']);
  });

  it('computes at most 5 reroutes per trip, then only reports off route', () => {
    const engine = walk();
    engine.start(0);
    const reroutes: number[] = [];
    // Seven off-route episodes, 40 s apart, back on the route in between; asked every time.
    for (let n = 0; n < 7; n++) {
      const t0 = n * 40;
      engine.update(fix(at(100, 0), t0 - 1));
      engine.update(fix(at(100, 80), t0));
      expect(types(engine.update(fix(at(100, 80), t0 + 20)))).toEqual(['offRoute']);
      if (engine.requestReroute((t0 + 20) * 1000)) reroutes.push(n);
    }
    expect(reroutes).toEqual([0, 1, 2, 3, 4]);
    expect(engine.rerouteLimitReached).toBe(true);
    expect(engine.canReroute(1_000_000)).toBe(false);
    expect(engine.offRouteCount).toBe(7);
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

describe('leg progression', () => {
  it('ends a walk leg within 40 m of its end (20 m between its own steps)', () => {
    const engine = new NavigationEngine(
      [
        step({ legIndex: 0, polyline: [at(0), at(300)], distanceM: 300 }),
        step({ legIndex: 0, polyline: [at(300), at(600)], distanceM: 300 }),
        step({ legIndex: 1, legMode: 'auto', kind: 'drive', polyline: [at(600), at(3000)] }),
      ],
      at(3000),
    );
    engine.start(0);
    engine.update(fix(at(270), 10)); // 30 m before a turn: not yet
    expect(engine.index).toBe(0);
    engine.update(fix(at(285), 20));
    expect(engine.index).toBe(1);
    engine.update(fix(at(565), 30)); // 35 m before the leg's end
    expect(engine.index).toBe(2);
  });

  it('"Next leg" by hand skips the rest of the leg, marked manual', () => {
    const engine = new NavigationEngine(
      [
        step({ legIndex: 0, polyline: [at(0), at(300)] }),
        step({ legIndex: 0, polyline: [at(300), at(600)] }),
        step({ legIndex: 1, polyline: [at(600), at(900)] }),
      ],
      at(900),
    );
    engine.start(0);
    expect(engine.hasNextLeg).toBe(true);
    expect(engine.skipLeg(5_000)).toMatchObject([{ type: 'stepStart', index: 2 }]);
    expect(engine.history[0]).toMatchObject({ manual: true, endedAt: 5_000 });
    expect(engine.hasNextLeg).toBe(false);
    expect(engine.skipLeg(6_000)).toEqual([]); // the last leg ends on arrival only
  });

  it('remaining distance and time on the current leg', () => {
    const engine = new NavigationEngine(
      [
        step({ legIndex: 0, polyline: [at(0), at(400)], distanceM: 400, predictedDurationS: 300 }),
        step({
          legIndex: 0,
          polyline: [at(400), at(600)],
          distanceM: 200,
          predictedDurationS: 150,
        }),
        step({ legIndex: 1, polyline: [at(600), at(900)], distanceM: 300 }),
      ],
      at(900),
    );
    engine.start(0);
    engine.update(fix(at(100), 10));
    const left = engine.legRemaining();
    expect(left.distanceM).toBeCloseTo(500, -1);
    expect(left.durationS).toBeCloseTo(375, -1);
  });
});

describe('alert thresholds', () => {
  const rideOf = (mode: 'bus' | 'metro' | 'train') =>
    new NavigationEngine(
      [
        step({
          kind: 'transit',
          legMode: mode,
          polyline: [at(0), at(5000)],
          distanceM: 5000,
          transit: { mode, line: 'L', boardStop: 'A', alightStop: 'Swargate', stopCount: 8 },
        }),
        step({ legIndex: 1, polyline: [at(5000), at(5000, 400)], distanceM: 400 }),
      ],
      at(5000, 400),
    );

  const cases: ['bus' | 'metro' | 'train', number, number][] = [
    ['bus', 4350, 4450],
    ['metro', 4050, 4150],
    ['train', 4050, 4150],
  ];
  it.each(cases)('%s: "get off soon" once within its threshold', (mode, before, after) => {
    const engine = rideOf(mode);
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(before), 100, { speed: 8 })))).toEqual([]);
    expect(engine.update(fix(at(after), 110, { speed: 8 }))).toMatchObject([
      { type: 'alightSoon', stop: 'Swargate' },
    ]);
    expect(engine.update(fix(at(after + 50), 115, { speed: 8 }))).toEqual([]); // once
  });

  it('"your stop is next" once within 250 m', () => {
    const engine = rideOf('bus');
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    engine.update(fix(at(4500), 100, { speed: 8 })); // get off soon
    expect(engine.update(fix(at(4700), 120, { speed: 8 }))).toEqual([]); // 300 m
    expect(engine.update(fix(at(4760), 125, { speed: 8 }))).toMatchObject([
      { type: 'stopNext', stop: 'Swargate' },
    ]);
    expect(engine.update(fix(at(4800), 130, { speed: 8 }))).toEqual([]);
  });

  it('a long first jump fires both at once', () => {
    const engine = rideOf('bus');
    engine.start(0);
    engine.update(fix(at(50), 10, { speed: 8 }));
    expect(types(engine.update(fix(at(4800), 100, { speed: 8 })))).toEqual([
      'alightSoon',
      'stopNext',
    ]);
  });
});
