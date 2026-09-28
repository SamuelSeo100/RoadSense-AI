import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

import { Icon } from './Icon';
import { Text } from './Text';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Plain string, or rich content (e.g. text with inline links). */
  label: ReactNode;
  /** Required when `label` isn't a string. */
  accessibilityLabel?: string;
  error?: boolean;
  disabled?: boolean;
}

/** 20dp box inside a 48dp-tall touch row. */
export function Checkbox({
  checked,
  onChange,
  label,
  accessibilityLabel,
  error = false,
  disabled = false,
}: CheckboxProps) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
      className={cn('min-h-touch flex-row items-center gap-space-md', disabled && 'opacity-40')}
    >
      <View
        className={cn(
          'h-5 w-5 items-center justify-center rounded border-2',
          checked ? 'border-primary bg-primary' : error ? 'border-error' : 'border-outline',
        )}
      >
        {checked ? <Icon name="check" size={16} tone="on-primary" /> : null}
      </View>
      <View className="flex-1">
        {typeof label === 'string' ? <Text variant="body-md">{label}</Text> : label}
      </View>
    </Pressable>
  );
}
