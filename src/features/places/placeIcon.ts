import type { IconName } from '@/components/routly/Icon';
import { colors, modeColors } from '@/theme/routly';

/** Icon and tile colours for a saved place's label. */
export function placeIcon(label: string): { icon: IconName; bg: string; fg: string } {
  switch (label) {
    case 'Home':
      return { icon: 'home', bg: colors.primaryTint, fg: colors.primary };
    case 'College':
      return { icon: 'college', bg: modeColors.bus.pillBg, fg: modeColors.bus.pillText };
    case 'Work':
      return { icon: 'work', bg: modeColors.metro.pillBg, fg: modeColors.metro.pillText };
    default:
      return { icon: 'pin', bg: colors.background, fg: colors.textSecondary };
  }
}
