import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';

interface SectionHeaderProps {
  title: string;
  /** Element right after the title (e.g. a badge). */
  badge?: ReactNode;
  /** Text link on the right (e.g. "Edit"). */
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, badge, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-space-xs">
        <Text variant="headline-sm" role="heading">
          {title}
        </Text>
        {badge}
      </View>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={12}
          accessibilityRole="link"
          accessibilityLabel={`${actionLabel} ${title}`}
        >
          <Text variant="label-md" tone="primary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
