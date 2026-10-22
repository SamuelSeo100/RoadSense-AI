import { describe, expect, it } from '@jest/globals';

import { legSteps, type GoogleNavStep } from '../googleDirectionsService';
import { encodePolyline } from '../polyline';

const p = (lat: number) => ({ latitude: lat, longitude: 73.8 });
const gStep = (from: number, to: number, text?: string): GoogleNavStep => ({
  distanceMeters: 100,
  staticDuration: '80s',
  polyline: { encodedPolyline: encodePolyline([p(from), p(to)]) },
  navigationInstruction: text ? { instructions: text, maneuver: 'TURN_LEFT' } : {},
});

describe('legSteps', () => {
  it('folds a step without text into the one before (no hole in the path)', () => {
    const steps = legSteps([
      gStep(18.5, 18.501, 'Head north'),
      gStep(18.501, 18.504), // "continue": no instruction
      gStep(18.504, 18.505, 'Turn left\nDestination on the right'),
    ]);
    expect(steps.map((s) => s.instruction)).toEqual([
      'Head north',
      'Turn left. Destination on the right',
    ]);
    expect(steps[0]).toMatchObject({ distanceM: 200, durationSec: 160 });
    expect(steps[0]!.polyline[steps[0]!.polyline.length - 1]!.latitude).toBeCloseTo(18.504, 5);
  });

  it('a first step without text reads "Continue"', () => {
    expect(legSteps([gStep(18.5, 18.501)]).map((s) => s.instruction)).toEqual(['Continue']);
    expect(legSteps(undefined)).toEqual([]);
  });
});
