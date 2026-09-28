import type { IconName } from '@/components/ui/Icon';
import type { ModeColorKey } from '@/theme/tokens';

export const TRANSIT_MODES = ['bus', 'metro', 'train', 'auto', 'cab', 'bike', 'walk'] as const;
export type TransitMode = (typeof TRANSIT_MODES)[number];

interface TransitModeInfo {
  label: string;
  icon: IconName;
  /** Key into `modeColors` (metro defaults to the Aqua line). */
  color: ModeColorKey;
}

export const transitModeInfo: Record<TransitMode, TransitModeInfo> = {
  bus: { label: 'Bus', icon: 'directions-bus', color: 'bus' },
  metro: { label: 'Metro', icon: 'subway', color: 'metro-aqua' },
  train: { label: 'Train', icon: 'train', color: 'train' },
  auto: { label: 'Auto', icon: 'electric-rickshaw', color: 'auto' },
  cab: { label: 'Cab', icon: 'local-taxi', color: 'cab' },
  bike: { label: 'Bike', icon: 'two-wheeler', color: 'bike' },
  walk: { label: 'Walk', icon: 'directions-walk', color: 'walk' },
};
