import { describe, expect, it } from '@jest/globals';

import { nextLegPreview, stopsRemaining, transferText } from '../legView';
import type { NavStep } from '../steps';

import { at, step } from '../__fixtures__/helpers';

const ride = (
  legIndex: number,
  from: number,
  to: number,
  over: Partial<NonNullable<NavStep['transit']>> = {},
) =>
  step({
    kind: 'transit',
    legMode: over.mode ?? 'bus',
    legIndex,
    polyline: [at(from), at(to)],
    distanceM: to - from,
    transit: {
      mode: 'bus',
      line: 'Bus 13',
      boardStop: `Stop ${from}`,
      alightStop: `Stop ${to}`,
      stopCount: 10,
      ...over,
    },
  });

describe('stopsRemaining', () => {
  it('counts the known stations still ahead', () => {
    const stops = [at(0), at(1000), at(2000), at(3000)];
    const s = ride(0, 0, 3000, { mode: 'metro', stopCount: 3, stopsLatLng: stops });
    expect(stopsRemaining(s, at(100), 100)).toEqual({ count: 3, estimated: false });
    expect(stopsRemaining(s, at(1500), 1500)).toEqual({ count: 2, estimated: false });
    expect(stopsRemaining(s, at(2980), 2980)).toEqual({ count: 1, estimated: false });
  });

  it('estimates from progress when only the stop count is known', () => {
    const s = ride(0, 0, 5000);
    expect(stopsRemaining(s, at(0), 0)).toEqual({ count: 10, estimated: true });
    expect(stopsRemaining(s, at(2600), 2600)).toEqual({ count: 5, estimated: true });
    expect(stopsRemaining(s, at(4990), 4990)).toEqual({ count: 1, estimated: true });
    expect(stopsRemaining(ride(0, 0, 100, { stopCount: 0 }), null, 0)).toBeNull();
  });
});

describe('transferText', () => {
  const steps = [
    step({ legIndex: 0, polyline: [at(-200), at(0)], distanceM: 200 }),
    ride(1, 0, 3000, { line: 'Metro Aqua Line', alightStop: 'Swargate', mode: 'metro' }),
    step({ legIndex: 2, polyline: [at(3000), at(3100)], distanceM: 120 }),
    step({ legIndex: 2, polyline: [at(3100), at(3200)], distanceM: 80 }),
    ride(3, 3200, 6000, { line: 'Bus 13', boardStop: 'Shimla Office' }),
  ];

  it('from the ride before and from the walk between', () => {
    const text = 'Exit at Swargate → walk 200 m → Bus 13 at Shimla Office';
    expect(transferText(steps, 1)).toBe(text);
    expect(transferText(steps, 2)).toBe(text);
    expect(transferText(steps, 3)).toBe(text);
  });

  it('a change inside the station, and none without a ride on both sides', () => {
    const change = [
      ride(0, 0, 3000, { alightStop: 'Civil Court', mode: 'metro' }),
      step({ legIndex: 1, polyline: [], distanceM: 0 }),
      ride(2, 3000, 6000, { line: 'Metro Aqua Line', boardStop: 'Civil Court', mode: 'metro' }),
    ];
    expect(transferText(change, 0)).toBe(
      'Exit at Civil Court → change to Metro Aqua Line at Civil Court',
    );
    expect(transferText(steps, 0)).toBeNull(); // first walk: no ride before
    expect(transferText(steps, 4)).toBeNull(); // last ride: no ride after
  });
});

describe('nextLegPreview', () => {
  const steps = [
    step({ legIndex: 0, polyline: [at(0), at(200)], distanceM: 200 }),
    ride(1, 200, 3000, { headsign: 'Hinjewadi', boardStop: 'Natraj' }),
    step({ legIndex: 2, polyline: [at(3000), at(3300)], distanceM: 300 }),
    step({ legIndex: 3, kind: 'drive', legMode: 'auto', polyline: [at(3300), at(6000)] }),
  ];

  it('the next leg in one line, null at the last', () => {
    expect(nextLegPreview(steps, 0, 'Office')).toEqual({
      mode: 'bus',
      text: 'Bus 13 towards Hinjewadi at Natraj',
    });
    expect(nextLegPreview(steps, 1, 'Office')).toEqual({
      mode: 'walk',
      text: 'Walk 300 m to Office',
    });
    expect(nextLegPreview(steps, 2, 'Office')).toEqual({ mode: 'auto', text: 'Auto to Office' });
    expect(nextLegPreview(steps, 3, 'Office')).toBeNull();
  });
});
