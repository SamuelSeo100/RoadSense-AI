import type { SafetyService } from '../types';

/**
 * No safety data yet. TODO(safety): fetch zones from the backend (police /
 * crowd reports, unlit stretches, closures) and cache them per area.
 */
export function createMockSafetyService(): SafetyService {
  return {
    async unsafeZones() {
      return [];
    },
  };
}
