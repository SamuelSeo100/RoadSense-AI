import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  /** Optional action below the message. */
  children?: ReactNode;
}

/** Centered icon + title + message, for screens with nothing to show yet. */
export function EmptyState({ icon, title, message, children }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-space-xl">
      <View className="mb-space-lg h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <Icon name={icon} size={32} tone="primary" />
      </View>
      <Text variant="headline-sm" role="heading" className="text-center">
        {title}
      </Text>
      <Text variant="body-md" tone="on-surface-variant" className="mt-space-xs text-center">
        {message}
      </Text>
      {children}
    </View>
  );
}
