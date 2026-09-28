import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import { colors, type ColorToken } from '@/theme/tokens';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface IconProps {
  /** Material icon name (the Stitch `material-symbols` names, with `-` instead of `_`). */
  name: IconName;
  size?: number;
  tone?: ColorToken;
  /** Pass a raw color only for values outside the palette (e.g. mode colors). */
  color?: string;
}

/** Decorative by default: give the parent control an accessibility label. */
export function Icon({ name, size = 24, tone = 'on-surface', color }: IconProps) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color ?? colors[tone]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
