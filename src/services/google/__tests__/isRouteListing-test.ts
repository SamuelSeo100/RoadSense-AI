import { describe, expect, it } from '@jest/globals';

import { isRouteListing } from '../googlePlacesService';

describe('isRouteListing', () => {
  it('drops listings that describe a route between two places', () => {
    expect(isRouteListing('PCMC to Swargate Metro route')).toBe(true);
    expect(isRouteListing('Nigdi - Katraj bus line')).toBe(true);
    expect(isRouteListing('Hinjewadi → Shivajinagar Metro Line ')).toBe(true);
  });

  it('keeps real places', () => {
    for (const name of [
      'Swargate',
      'PCMC Metro Station',
      'Route 66 Cafe',
      'Line Bazaar',
      'Gateway to India Restaurant',
      'Golden Metrolink',
    ]) {
      expect(isRouteListing(name)).toBe(false);
    }
  });
});
