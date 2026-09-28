import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './Text';

interface DividerProps {
  /** Optional centered label, e.g. "or continue with". Rendered uppercase. */
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <View className={cn('h-px w-full bg-surface-container-high', className)} />;
  }

  return (
    <View className={cn('flex-row items-center gap-space-md', className)} accessibilityRole="text">
      <View className="h-px flex-1 bg-surface-container-high" />
      <Text variant="label-sm" tone="on-surface-variant" caps>
        {label}
      </Text>
      <View className="h-px flex-1 bg-surface-container-high" />
    </View>
  );
}
