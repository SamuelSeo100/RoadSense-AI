export const CITIES = ['pune', 'pimpri-chinchwad', 'mumbai', 'bengaluru'] as const;
export type City = (typeof CITIES)[number];

export const DEFAULT_CITY: City = 'pune';

/** Only cities with routing data are selectable. */
export const cityInfo: Record<City, { label: string; supported: boolean }> = {
  pune: { label: 'Pune', supported: true },
  'pimpri-chinchwad': { label: 'Pimpri-Chinchwad', supported: true },
  mumbai: { label: 'Mumbai', supported: false },
  bengaluru: { label: 'Bengaluru', supported: false },
};
