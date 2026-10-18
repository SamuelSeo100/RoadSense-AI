import { describe, expect, it } from '@jest/globals';

import { at, step } from '../__fixtures__/helpers';
import { alightBackupAt } from '../alightBackup';

const MIN = 60_000;
/** 20-min ride over 4 stops (5 min each), scheduled to leave at minute 10. */
const ride = (scheduledDep: string | undefined = new Date(10 * MIN).toISOString()) =>
  step({
    kind: 'transit',
    legMode: 'metro',
    polyline: [at(0), at(4000)],
    predictedDurationS: 20 * 60,
    transit: {
      mode: 'metro',
      line: 'Metro Purple Line',
      boardStop: 'PCMC',
      alightStop: 'Swargate',
      stopCount: 4,
      scheduledDep,
    },
  });

describe('alightBackupAt', () => {
  it('before boarding: one stop before arrival, from the scheduled departure', () => {
    // Reached the platform at minute 4, train at 10 → alert at 10 + 20 − 5.
    expect(alightBackupAt(ride(), { reachedStopAt: 4 * MIN, now: 4 * MIN })).toBe(25 * MIN);
  });

  it('before boarding: from reaching the stop when that is after the scheduled departure', () => {
    expect(alightBackupAt(ride(), { reachedStopAt: 12 * MIN, now: 12 * MIN })).toBe(27 * MIN);
    // No schedule (Google ride without times): from reaching the stop.
    expect(alightBackupAt(ride(''), { reachedStopAt: 3 * MIN, now: 3 * MIN })).toBe(18 * MIN);
  });

  it('after boarding: from the detected boarding time, whatever the schedule said', () => {
    expect(
      alightBackupAt(ride(), { reachedStopAt: 4 * MIN, boardedAt: 13 * MIN, now: 13 * MIN }),
    ).toBe(28 * MIN);
    // A train that left before its scheduled time.
    expect(
      alightBackupAt(ride(), { reachedStopAt: 4 * MIN, boardedAt: 8 * MIN, now: 8 * MIN }),
    ).toBe(23 * MIN);
  });

  it('a 1-stop ride alerts at boarding; too soon or not a ride → none', () => {
    const one = ride();
    one.transit!.stopCount = 1;
    one.predictedDurationS = 180;
    expect(alightBackupAt(one, { reachedStopAt: 0, boardedAt: 5 * MIN, now: 4 * MIN })).toBe(
      5 * MIN,
    );
    expect(alightBackupAt(one, { reachedStopAt: 0, boardedAt: 5 * MIN, now: 5 * MIN })).toBeNull();
    expect(
      alightBackupAt(step({ polyline: [at(0), at(100)] }), { reachedStopAt: 0, now: 0 }),
    ).toBeNull();
  });
});
