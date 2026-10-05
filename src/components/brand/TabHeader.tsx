import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { elevation } from '@/theme/tokens';

import { LogoMark } from './Logo';

interface TabHeaderProps {
  /** Screen name under the brand label, e.g. "Home". */
  title: string;
  /** Hide the avatar shortcut (on the Profile tab itself). */
  showAvatar?: boolean;
}

/** 64dp top bar for the tab screens: logo · ROADSENSE AI / title · avatar (home.html header). */
export function TabHeader({ title, showAvatar = true }: TabHeaderProps) {
  return (
    <View
      className="h-16 flex-row items-center justify-between bg-surface px-gutter"
      style={{ boxShadow: elevation.header }}
    >
      <View className="flex-row items-center gap-space-sm">
        <LogoMark size="sm" />
        <View>
          <Text variant="label-sm" tone="primary" caps>
            RoadSense AI
          </Text>
          <Text variant="title-md" role="heading">
            {title}
          </Text>
        </View>
      </View>
      {showAvatar ? (
        <Pressable
          onPress={() => router.navigate('/profile')}
          className="-mr-2 h-12 w-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Icon name="person" size={18} tone="on-primary" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
