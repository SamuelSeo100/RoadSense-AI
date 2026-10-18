import { describe, expect, it } from '@jest/globals';

import { formatClock12 } from '../routeFormat';

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
