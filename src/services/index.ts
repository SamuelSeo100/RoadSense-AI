import { hasGoogleMapsKey } from './config';
import { createGoogleDirectionsService } from './google/googleDirectionsService';
import { createGooglePlacesService } from './google/googlePlacesService';
import { createGoogleRoutingService } from './google/googleRoutingService';
import { createLocationService } from './locationService';
import { createMockDirectionsService } from './mock/mockDirectionsService';
import { createMockPlacesService } from './mock/mockPlacesService';
import { createMockSafetyService } from './mock/mockSafetyService';
import { createMockAiService } from './mock/mockAiService';
import { createMockHistoryService } from './mock/mockHistoryService';
import { createLocalPreferencesService } from './mock/mockPreferencesService';
import { createMockRoutingService } from './mock/mockRoutingService';
import type {
  AiService,
  DirectionsService,
  HistoryService,
  LocationService,
  PlacesService,
  PreferencesService,
  RoutingService,
  SafetyService,
} from './types';

export * from './types';
export { rankRoutes } from './ranking';
/** Origin used until the user's location is known (TODO(api): city centre from the backend). */
export { fallbackOrigin } from './mock/geometry';

export { hasGoogleMapsKey, serviceConfig } from './config';

/**
 * The app's data services. Screens only see these interfaces.
 * TODO(api): when the Django/Flask backend is ready, add HTTP implementations
 * that call `serviceConfig.apiBaseUrl` (and Google's Routes / Places /
 * Geocoding APIs with `serviceConfig.googleMapsApiKey`) and pick them here instead of the mocks.
 */
export const historyService: HistoryService = createMockHistoryService();
export const aiService: AiService = createMockAiService();
export const preferencesService: PreferencesService = createLocalPreferencesService();
export const locationService: LocationService = createLocationService();

export const safetyService: SafetyService = createMockSafetyService();

/** Real Google Places / Routes when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set, offline mocks otherwise. */
export const placesService: PlacesService = hasGoogleMapsKey
  ? createGooglePlacesService()
  : createMockPlacesService();
export const directionsService: DirectionsService = hasGoogleMapsKey
  ? createGoogleDirectionsService(safetyService)
  : createMockDirectionsService();

const mockRouting = createMockRoutingService();
/**
 * Real multimodal routes (Google Routes API) when a key is set, the mock
 * otherwise. Place search / geocoding stay on the mock for now.
 */
export const routingService: RoutingService = hasGoogleMapsKey
  ? createGoogleRoutingService({
      directions: directionsService,
      preferences: preferencesService,
      places: mockRouting,
    })
  : mockRouting;
