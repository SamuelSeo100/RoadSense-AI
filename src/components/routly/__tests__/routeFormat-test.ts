import { describe, expect, it } from '@jest/globals';

import type { Leg } from '@/services/types';

import { formatClock12, nextDepartureNote } from '../routeFormat';

describe('formatClock12', () => {
  it('shows timetable departures in 12-hour time with AM / PM', () => {
    expect(formatClock12('16:48')).toBe('4:48 PM');
    expect(formatClock12('08:05')).toBe('8:05 AM');
    expect(formatClock12('00:10')).toBe('12:10 AM');
    expect(formatClock12('12:00')).toBe('12:00 PM');
    expect(formatClock12('23:59')).toBe('11:59 PM');
  });

  it('leaves anything else unchanged', () => {
    expect(formatClock12('soon')).toBe('soon');
  });
});

describe('nextDepartureNote', () => {
  const walk: Leg = { mode: 'walk', label: 'Walk 5m', durationMin: 5 };
  const train = (waitMin: number): Leg => ({
    mode: 'train',
    label: 'Train · to Lonavala',
    durationMin: 74,
    departure: '10:01',
    realtime: false,
    waitMin,
  });

  it('shows a long wait for the first scheduled ride', () => {
    expect(nextDepartureNote({ legs: [walk, train(69)] })).toBe(
      'Next train 10:01 AM (waits 69 min)',
    );
  });

  it('leaves out short waits, and is null without a scheduled departure', () => {
    expect(nextDepartureNote({ legs: [walk, train(3)] })).toBe('Next train 10:01 AM');
    expect(nextDepartureNote({ legs: [walk] })).toBeNull();
  });
});
