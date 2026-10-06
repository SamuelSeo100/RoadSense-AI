import Svg, { Path } from 'react-native-svg';

import { colors, type Mode } from '@/theme/routly';

import { iconPaths, type IconName } from './iconPaths';

export type { IconName };

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Routly stroke icon. Decorative: give the parent control the accessibility label. */
export function Icon({ name, size = 24, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={iconPaths[name]} />
    </Svg>
  );
}

/** Icon per transport mode (auto shares the cab glyph, train the metro one). */
export const modeIcon: Record<Mode, IconName> = {
  walk: 'walk',
  metro: 'metro',
  bus: 'bus',
  auto: 'cab',
  cab: 'cab',
  bike: 'bike',
  cycle: 'cycle',
  train: 'metro',
};
