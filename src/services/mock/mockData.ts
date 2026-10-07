/**
 * Sample data for the mock services, generated from
 * routly-internal-screens/specs/mock-data.json. Coordinates are approximate Pune
 * locations; replace with real backend data.
 */
import type { MonthlyStats, Place, Preferences, Route, Trip } from '../types';

interface MockData {
  places: Place[];
  homePreview: Route[];
  routes: Route[];
  trips: Trip[];
  monthlyStats: MonthlyStats;
  defaultPreferences: Preferences;
  aiSuggestions: string[];
}

export const mockData: MockData = {
  places: [
    {
      id: 'pimpri',
      name: 'Pimpri',
      area: 'Pimpri',
      location: {
        latitude: 18.6279,
        longitude: 73.8009,
      },
    },
    {
      id: 'pune-station',
      name: 'Pune Station',
      area: 'Pune',
      location: {
        latitude: 18.5289,
        longitude: 73.8744,
      },
    },
    {
      id: 'shivajinagar',
      name: 'Shivajinagar',
      area: 'Shivajinagar',
      location: {
        latitude: 18.5308,
        longitude: 73.8475,
      },
    },
    {
      id: 'hinjewadi-1',
      name: 'Hinjewadi Phase 1',
      area: 'Hinjewadi',
      location: {
        latitude: 18.5912,
        longitude: 73.7389,
      },
    },
    {
      id: 'phoenix-mall',
      name: 'Phoenix Mall',
      area: 'Viman Nagar',
      location: {
        latitude: 18.5622,
        longitude: 73.9167,
      },
    },
  ],
  homePreview: [
    {
      id: 'p-metro',
      name: 'Metro',
      mapKey: 'metro',
      durationMin: 34,
      costInr: 30,
      walkingKm: 0.7,
      transfers: 0,
      traffic: 'Light',
      aiPick: true,
      legs: [
        {
          mode: 'walk',
          label: 'Walk',
          durationMin: 5,
        },
        {
          mode: 'metro',
          label: 'Metro',
          durationMin: 24,
        },
        {
          mode: 'walk',
          label: 'Walk',
          durationMin: 5,
        },
      ],
      meta: '0.7 km walk · 0 transfers · Low traffic',
      score: {
        fastest: 2,
        cheapest: 2,
        walking: 2,
        transfers: 1,
      },
    },
    {
      id: 'p-bus',
      name: 'Bus + Walk',
      mapKey: 'bus',
      durationMin: 49,
      costInr: 20,
      walkingKm: 1.2,
      transfers: 1,
      traffic: 'Moderate',
      legs: [
        {
          mode: 'bus',
          label: 'Bus',
          durationMin: 38,
        },
        {
          mode: 'walk',
          label: 'Walk',
          durationMin: 11,
        },
      ],
      meta: '1.2 km walk · 1 transfer · Medium traffic',
      score: {
        fastest: 3,
        cheapest: 1,
        walking: 3,
        transfers: 2,
      },
    },
    {
      id: 'p-cab',
      name: 'Cab',
      mapKey: 'cab',
      vehicle: 'car',
      durationMin: 29,
      costInr: 240,
      walkingKm: 0,
      transfers: 0,
      traffic: 'Heavy',
      legs: [
        {
          mode: 'cab',
          label: 'Cab (Uber / Ola)',
          durationMin: 29,
        },
      ],
      meta: 'No walking · Direct · Heavy on Old Mumbai Rd',
      score: {
        fastest: 1,
        cheapest: 3,
        walking: 1,
        transfers: 1,
      },
    },
  ],
  routes: [
    {
      id: 'a',
      name: 'Metro + Auto',
      mapKey: 'metro',
      durationMin: 38,
      costInr: 62,
      walkingKm: 0.6,
      transfers: 1,
      traffic: 'Light',
      legs: [
        {
          mode: 'walk',
          label: 'Walk 5m',
          durationMin: 5,
        },
        {
          mode: 'metro',
          label: 'Metro',
          durationMin: 21,
        },
        {
          mode: 'auto',
          label: 'Auto 12m',
          durationMin: 12,
        },
      ],
      score: {
        fastest: 2,
        cheapest: 2,
        walking: 2,
        transfers: 2,
      },
    },
    {
      id: 'b',
      name: 'Bus',
      mapKey: 'bus',
      durationMin: 54,
      costInr: 25,
      walkingKm: 1.1,
      transfers: 1,
      traffic: 'Moderate',
      legs: [
        {
          mode: 'walk',
          label: 'Walk 8m',
          durationMin: 8,
        },
        {
          mode: 'bus',
          label: 'Bus 312',
          durationMin: 22,
        },
        {
          mode: 'bus',
          label: 'Bus 299',
          durationMin: 18,
        },
        {
          mode: 'walk',
          label: 'Walk 6m',
          durationMin: 6,
        },
      ],
      score: {
        fastest: 4,
        cheapest: 1,
        walking: 4,
        transfers: 3,
      },
    },
    {
      id: 'c',
      name: 'Cab',
      mapKey: 'cab',
      vehicle: 'car',
      durationMin: 42,
      costInr: 310,
      walkingKm: 0,
      transfers: 0,
      traffic: 'Heavy',
      legs: [
        {
          mode: 'cab',
          label: 'Cab',
          durationMin: 42,
        },
      ],
      score: {
        fastest: 3,
        cheapest: 4,
        walking: 1,
        transfers: 1,
      },
    },
    {
      id: 'd',
      name: 'Bike taxi',
      mapKey: 'all',
      vehicle: 'bike',
      durationMin: 35,
      costInr: 95,
      walkingKm: 0.2,
      transfers: 0,
      traffic: 'Moderate',
      legs: [
        {
          mode: 'bike',
          label: 'Bike taxi',
          durationMin: 35,
        },
      ],
      score: {
        fastest: 1,
        cheapest: 3,
        walking: 3,
        transfers: 4,
      },
    },
    {
      id: 'e',
      name: 'Cycle',
      mapKey: 'all',
      vehicle: 'cycle',
      durationMin: 48,
      costInr: 0,
      walkingKm: 0,
      transfers: 0,
      traffic: 'Light',
      legs: [
        {
          mode: 'cycle',
          label: 'Cycle',
          durationMin: 48,
        },
      ],
      score: {
        fastest: 5,
        cheapest: 0,
        walking: 1.5,
        transfers: 1.5,
      },
    },
  ],
  trips: [
    {
      id: 't1',
      dayLabel: 'TODAY',
      from: 'Pimpri',
      to: 'Pune Station',
      mode: 'metro',
      modeLabel: 'Metro',
      startTime: '9:12 AM',
      durationMin: 34,
      costInr: 30,
    },
    {
      id: 't2',
      dayLabel: 'TODAY',
      from: 'Pune Station',
      to: 'Shivajinagar',
      mode: 'bus',
      modeLabel: 'Bus + Walk',
      startTime: '1:40 PM',
      durationMin: 22,
      costInr: 15,
    },
    {
      id: 't3',
      dayLabel: 'YESTERDAY',
      from: 'College',
      to: 'Pimpri',
      mode: 'cab',
      modeLabel: 'Cab',
      startTime: '7:05 PM',
      durationMin: 31,
      costInr: 210,
    },
    {
      id: 't4',
      dayLabel: 'YESTERDAY',
      from: 'Pimpri',
      to: 'College',
      mode: 'metro',
      modeLabel: 'Metro',
      startTime: '8:20 AM',
      durationMin: 41,
      costInr: 35,
    },
    {
      id: 't5',
      dayLabel: 'SATURDAY',
      from: 'Pimpri',
      to: 'Phoenix Mall',
      mode: 'bus',
      modeLabel: 'Bus',
      startTime: '5:30 PM',
      durationMin: 48,
      costInr: 25,
    },
  ],
  monthlyStats: {
    trips: 18,
    spentInr: 1240,
    savedVsCabInr: 2860,
    modeMix: [
      {
        mode: 'metro',
        percent: 45,
      },
      {
        mode: 'bus',
        percent: 30,
      },
      {
        mode: 'cab',
        percent: 15,
      },
      {
        mode: 'walk',
        percent: 10,
      },
    ],
  },
  defaultPreferences: {
    defaultPriority: 'fastest',
    learnFromTrips: true,
    voiceForAiMode: true,
    liveTrafficAlerts: true,
    aiModeEnabled: true,
    quickLaunchEnabled: true,
    quickLaunchCombo: 'power+volume_up',
    // Own vehicles are opt-in (Profile › Travel preferences).
    vehicles: {
      car: false,
      bike: false,
      cycle: false,
    },
    savedPlaces: [
      {
        id: 'home',
        label: 'Home',
      },
      {
        id: 'college',
        label: 'College',
      },
    ],
    linkedApps: [],
    showTraffic: true,
  },
  aiSuggestions: ['Quickest to Pune Station', 'Cheapest to college', 'Take me home'],
};
