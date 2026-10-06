import type { MapStyleElement } from 'react-native-maps';

import { colors } from '@/theme/routly';

/** Google Maps JSON style matching the mockup: light land, mint parks, pale water, white roads. */
export const mapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: colors.map.land }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.map.label }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.map.road }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: colors.map.park }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.map.road }] },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: colors.map.roadStroke }],
  },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.map.water }] },
];

/** `#RRGGBB` + opacity → `rgba()`, for faded (unselected) polylines. */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
