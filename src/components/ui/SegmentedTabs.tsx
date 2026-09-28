import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';
import { elevation } from '@/theme/tokens';

import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  className?: string;
}

/** Visual height is 42dp (as in the design); hitSlop brings each tab's touch area to 48dp. */
const TAB_HIT_SLOP = { top: 3, bottom: 3 };

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <View
      className={cn('flex-row rounded-xl bg-surface-container-low p-1', className)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={TAB_HIT_SLOP}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            className={cn(
              'flex-1 items-center justify-center rounded-lg py-2',
              selected ? 'bg-surface-container-lowest' : 'active:bg-surface-container',
            )}
            style={selected ? { boxShadow: elevation.card } : undefined}
          >
            <Text variant="label-lg" tone={selected ? 'primary' : 'on-surface-variant'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
