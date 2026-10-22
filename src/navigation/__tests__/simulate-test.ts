import { describe, expect, it } from '@jest/globals';

import { navConfig, NavigationEngine, type NavEvent } from '../engine';
import { distanceM } from '../geo';
import { planDurationS, simConfig, simulatedFix, simulationPlan } from '../simulate';

import { at, step } from '../__fixtures__/helpers';

/** Walk 500 m → bus 6 km → walk 300 m. */
const trip = () => [
  step({ legIndex: 0, polyline: [at(0), at(500)], distanceM: 500 }),
  step({
    kind: 'transit',
    legMode: 'bus',
    legIndex: 1,
    polyline: [at(500), at(3000), at(6500)],
    distanceM: 6000,
    transit: { mode: 'bus', line: 'Bus 13', boardStop: 'A', alightStop: 'B', stopCount: 12 },
  }),
  step({ legIndex: 2, polyline: [at(6500), at(6500, 300)], distanceM: 300 }),
];
const destination = at(6500, 300);

describe('simulationPlan', () => {
  it('walks at 5 km/h, waits at the stop, rides at 18 km/h', () => {
    const plan = simulationPlan(trip(), destination);
    const walkS = 500 / (5 / 3.6);
    const busS = 6000 / (18 / 3.6);
    const lastWalkS = 300 / (5 / 3.6);
    expect(planDurationS(plan)).toBeCloseTo(walkS + simConfig.boardDwellS + busS + lastWalkS, 0);
    const mid = simulatedFix(plan, walkS + simConfig.boardDwellS + busS / 2, 1234);
    expect(mid.speed).toBeCloseTo(5, 1); // m/s, the real (not playback) speed
    expect(mid.t).toBe(1234);
    expect(distanceM({ latitude: mid.lat, longitude: mid.lng }, at(3500))).toBeLessThan(5);
  });
});

describe('replaying a simulation through the engine', () => {
  it('boards, alerts, alights and arrives, at 4× playback', () => {
    const steps = trip();
    const plan = simulationPlan(steps, destination);
    const engine = new NavigationEngine(steps, destination);
    const events: NavEvent[] = [...engine.start(0)];
    let simS = 0;
    for (let tick = 1; engine.status === 'navigating' && tick < 5000; tick++) {
      simS += 4;
      events.push(...engine.update(simulatedFix(plan, simS, tick * 1000)));
    }
    const kinds = events.map((e) => (e.type === 'stepStart' ? `step${e.index}` : e.type));
    expect(kinds).toEqual([
      'step0',
      'step1',
      'boarded',
      'alightSoon',
      'stopNext',
      'step2',
      'arrived',
    ]);
    const rideRec = engine.history[1]!;
    expect(rideRec.alightedAt).toBeDefined();
    // The ride starts 40 m before the stop (walk-leg end): those 40 m, the wait, at 4×.
    const lastWalkS = navConfig.legEndM / (simConfig.speedKmh.walk / 3.6);
    expect(rideRec.boardedAt! - rideRec.startedAt).toBeLessThanOrEqual(
      ((lastWalkS + simConfig.boardDwellS) / 4 + 2) * 1000,
    );
  });
});
