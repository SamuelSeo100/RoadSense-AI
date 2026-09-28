import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';
import { elevation } from '@/theme/tokens';

interface CardProps extends ViewProps {
  /** Selected / interactive tier: teal border + teal ambient shadow (DESIGN.md › Elevation 3). */
  selected?: boolean;
  className?: string;
}

/** White containment card, 16dp radius, resting shadow (DESIGN.md › Elevation 2). */
export function Card({ selected = false, className, style, ...rest }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-card bg-surface-container-lowest p-5',
        selected && 'border-[1.5px] border-primary',
        className,
      )}
      style={[{ boxShadow: selected ? elevation.selected : elevation.card }, style]}
      {...rest}
    />
  );
}
