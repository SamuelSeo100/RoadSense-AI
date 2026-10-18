import { describe, expect, it } from '@jest/globals';

import type { Leg, Route } from '@/services/types';

import { modeFamily, pickReroute, routeToSteps } from '../steps';

import { at } from '../__fixtures__/helpers';

const destination = { name: 'Swargate', location: at(5000, 0) };

describe('routeToSteps: a Google route', () => {
  const route: Pick<Route, 'id' | 'legs' | 'source' | 'vehicle'> = {
    id: 'transit-0',
    source: 'google',
    legs: [
      {
        mode: 'walk',
        label: 'Walk 5m',
        durationMin: 5,
        distanceKm: 0.4,
        polyline: [at(0), at(300), at(300, 100)],
        steps: [
          {
            instruction: 'Head east on Old Mumbai Hwy',
            maneuver: 'DEPART',
            distanceM: 300,
            durationSec: 200,
            polyline: [at(0), at(300)],
          },
          {
            instruction: 'Turn left',
            maneuver: 'TURN_LEFT',
            distanceM: 100,
            durationSec: 100,
            polyline: [at(300), at(300, 100)],
          },
        ],
      },
      {
        mode: 'metro',
        label: 'Metro Purple Line',
        durationMin: 20,
        distanceKm: 4.5,
        stops: 8,
        from: 'PCMC',
        to: 'Swargate',
        headsign: 'Swargate',
        departureAt: '2026-10-19T03:05:00.000Z',
        lineColor: '#903373',
        polyline: [at(300, 100), at(4800, 0)],
      },
      { mode: 'walk', label: 'Walk 3m', durationMin: 3, polyline: [at(4800, 0), at(5000, 0)] },
    ],
  };
  const steps = routeToSteps(route, destination);

  it("splits walks into Google's turn-by-turn steps with Google's text", () => {
    expect(steps.map((s) => [s.kind, s.legIndex, s.instruction])).toEqual([
      ['walk', 0, 'Head east on Old Mumbai Hwy'],
      ['walk', 0, 'Turn left'],
      [
        'transit',
        1,
        'Board the Metro Purple Line towards Swargate at PCMC. Get off at Swargate (8 stops)',
      ],
      ['walk', 2, 'Walk to Swargate'],
    ]);
    // The leg's 5 minutes, shared 2:1 like Google's step times.
    expect(steps[0]!.predictedDurationS + steps[1]!.predictedDurationS).toBe(300);
    expect(steps[0]!.predictedDurationS).toBe(200);
    expect(steps[0]!.endPoint).toEqual(at(300));
  });

  it('carries the ride details (no stop coordinates from Google)', () => {
    expect(steps[2]).toMatchObject({
      source: 'google',
      distanceM: 4500,
      predictedDurationS: 1200,
      endPoint: at(4800, 0),
      transit: {
        mode: 'metro',
        line: 'Metro Purple Line',
        lineColor: '#903373',
        headsign: 'Swargate',
        boardStop: 'PCMC',
        alightStop: 'Swargate',
        scheduledDep: '2026-10-19T03:05:00.000Z',
        stopCount: 8,
      },
    });
    expect(steps[2]!.transit?.stopsLatLng).toBeUndefined();
  });
});

describe('routeToSteps: a timetable route', () => {
  const stations = [at(500), at(1500), at(2500)];
  const legs: Leg[] = [
    {
      mode: 'walk',
      label: 'Walk 6m',
      durationMin: 6,
      distanceKm: 0.5,
      polyline: [at(0), at(500)],
    },
    {
      mode: 'metro',
      label: 'Metro Purple',
      durationMin: 4,
      stops: 2,
      from: 'Station A',
      to: 'Station X',
      realtime: false,
      departure: '08:14',
      departureAt: '2026-10-19T02:44:00.000Z',
      headsign: 'Swargate',
      lineColor: '#903373',
      polyline: stations,
    },
    { mode: 'walk', label: 'Walk 4m', durationMin: 4, distanceKm: 0, polyline: [] },
    {
      mode: 'metro',
      label: 'Metro Aqua',
      durationMin: 4,
      stops: 1,
      from: 'Station X',
      to: 'Station B',
      realtime: false,
      headsign: 'Ramwadi',
      polyline: [at(2500), at(2500, 1000)],
    },
    {
      mode: 'auto',
      label: 'Auto from Station B',
      durationMin: 8,
      polyline: [at(2500, 1000), at(5000)],
    },
  ];
  const steps = routeToSteps({ id: 'timetable-0', source: 'routly_timetable', legs }, destination);

  it('writes our own instructions for every leg', () => {
    expect(steps.map((s) => s.instruction)).toEqual([
      'Walk 500 m to Station A',
      'Board the Metro Purple towards Swargate at Station A. Get off at Station X (2 stops)',
      'Change to the Metro Aqua at Station X',
      'Board the Metro Aqua towards Ramwadi at Station X. Get off at Station B (1 stop)',
      'Take an auto to Swargate',
    ]);
    expect(steps.map((s) => s.kind)).toEqual(['walk', 'transit', 'walk', 'transit', 'drive']);
  });

  it('keeps the station coordinates for "get off at the next stop", and the sources', () => {
    expect(steps[1]!.transit?.stopsLatLng).toEqual(stations);
    expect(steps[1]!.transit?.scheduledDep).toBe('2026-10-19T02:44:00.000Z');
    expect(steps.map((s) => s.source)).toEqual([
      'google',
      'routly_timetable',
      'google',
      'routly_timetable',
      'google',
    ]);
    // The interchange has no path: it ends at the next line's platform.
    expect(steps[2]!.endPoint).toEqual(at(2500));
  });

  it('gives a timetable train the maroon line colour', () => {
    const [train] = routeToSteps(
      {
        id: 't',
        source: 'routly_timetable',
        legs: [
          {
            mode: 'train',
            label: 'Train · to Lonavala',
            durationMin: 74,
            realtime: false,
            from: 'Shivaji Nagar',
            to: 'Lonavala',
            headsign: 'Lonavala',
            stops: 15,
            polyline: [at(0), at(1000)],
          },
        ],
      },
      destination,
    );
    expect(train!.instruction).toBe(
      'Board the local train towards Lonavala at Shivaji Nagar. Get off at Lonavala (15 stops)',
    );
    expect(train!.transit?.lineColor).toBe('#9D174D');
  });
});

describe('pickReroute', () => {
  const r = (modes: Leg['mode'][], vehicle?: Route['vehicle']) => ({
    vehicle,
    legs: modes.map((mode): Leg => ({ mode, label: mode, durationMin: 5 })),
  });

  it('keeps the mode family, preferring the same main ride', () => {
    const metro = r(['walk', 'metro', 'walk']);
    const bus = r(['walk', 'bus']);
    const cab = r(['cab']);
    expect(pickReroute(metro, [cab, bus, r(['metro'])])).toEqual(r(['metro']));
    expect(pickReroute(metro, [cab, bus])).toBe(bus);
    expect(pickReroute(r(['walk']), [cab, bus])).toBeNull();
    expect(modeFamily(r(['cab'], 'car'))).toBe('car');
    expect(modeFamily(r(['cab']))).toBe('cab');
  });
});
