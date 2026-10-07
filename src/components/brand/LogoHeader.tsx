import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';

import { LogoMark } from './Logo';

interface LogoHeaderProps {
  /** Shows the back arrow when provided. */
  onBack?: () => void;
}

/** 56dp bar: back arrow left, small centered logo (sign-up flow). */
export function LogoHeader({ onBack }: LogoHeaderProps) {
  return (
    <View className="h-14 flex-row items-center px-margin">
      <View className="w-12">
        {onBack ? (
          <Pressable
            onPress={onBack}
            className="-ml-3 h-12 w-12 items-center justify-center rounded-full active:bg-surface-container-high"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-back" size={24} />
          </Pressable>
        ) : null}
      </View>
      <View
        className="flex-1 flex-row items-center justify-center gap-space-sm"
        accessibilityRole="header"
        accessibilityLabel="Routly"
      >
        <LogoMark size="sm" />
        <Text variant="title-md" weight="bold" importantForAccessibility="no">
          Rout
          <Text variant="title-md" weight="bold" tone="primary">
            ly
          </Text>
        </Text>
      </View>
      {/* Balances the back button so the logo stays centered. */}
      <View className="w-12" />
    </View>
  );
}
