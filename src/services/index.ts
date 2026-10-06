import { env } from '@/lib/env';

import { createLocationService } from './locationService';
import { createMockAiService } from './mock/mockAiService';
import { createMockHistoryService } from './mock/mockHistoryService';
import { createLocalPreferencesService } from './mock/mockPreferencesService';
import { createMockRoutingService } from './mock/mockRoutingService';
import type {
  AiService,
  HistoryService,
  LocationService,
  PreferencesService,
  RoutingService,
} from './types';

export * from './types';
export { rankRoutes } from './ranking';
/** Origin used until the user's location is known (TODO(api): city centre from the backend). */
export { fallbackOrigin } from './mock/geometry';

/** Base URL of the routing/ML backend (EXPO_PUBLIC_API_URL). */
export const apiBaseUrl = env.apiUrl;

/**
 * The app's data services. Screens only see these interfaces.
 * TODO(api): when the Django/Flask backend is ready, add HTTP implementations
 * that call `apiBaseUrl` and pick them here instead of the mocks.
 */
export const routingService: RoutingService = createMockRoutingService();
export const historyService: HistoryService = createMockHistoryService();
export const aiService: AiService = createMockAiService();
export const preferencesService: PreferencesService = createLocalPreferencesService();
export const locationService: LocationService = createLocationService();
