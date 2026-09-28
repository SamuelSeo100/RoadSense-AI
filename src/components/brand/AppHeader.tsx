import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { elevation, typography } from '@/theme/tokens';

import { CityBadge } from './CityBadge';

/** Tailwind `tracking-tight` on the wordmark. */
const WORDMARK_TRACKING = typography['headline-sm'].fontSize * -0.025;

interface AppHeaderProps {
  city?: string;
  /** Shows the back arrow when provided. */
  onBack?: () => void;
  onAvatarPress?: () => void;
}

/** 56dp top bar: back · ROADSENSE + city badge · avatar (login.html header). */
export function AppHeader({ city = 'Pune', onBack, onAvatarPress }: AppHeaderProps) {
  return (
    <View
      className="h-14 flex-row items-center justify-between bg-surface px-margin"
      style={{ boxShadow: elevation.header }}
    >
      <View className="flex-row items-center gap-space-xs">
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
        <View className="flex-row items-center gap-space-xs pl-1">
          <Text
            variant="headline-sm"
            tone="primary"
            weight="bold"
            style={{ letterSpacing: WORDMARK_TRACKING }}
          >
            ROADSENSE
          </Text>
          <CityBadge city={city} />
        </View>
      </View>
      <Pressable
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        className="-mr-2 h-12 w-12 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Profile"
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Icon name="person" size={18} tone="on-primary" />
        </View>
      </Pressable>
    </View>
  );
}
