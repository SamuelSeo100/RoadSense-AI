import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, elevation } from '@/theme/tokens';

const tabs: { name: string; title: string; icon: IconName; activeIcon?: IconName }[] = [
  { name: 'home', title: 'Home', icon: 'directions-transit' },
  { name: 'routes', title: 'Routes', icon: 'alt-route' },
  { name: 'saved', title: 'Saved', icon: 'bookmark-border', activeIcon: 'bookmark' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

/** Signed-in shell: bottom tabs (home.html nav bar). Each tab draws its own header. */
export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          boxShadow: elevation.tabBar,
        },
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused }) => (
              <Icon
                name={(focused && t.activeIcon) || t.icon}
                size={24}
                tone={focused ? 'primary' : 'on-surface-variant'}
              />
            ),
            tabBarLabel: ({ focused }) => (
              <Text
                variant="label-sm"
                tone={focused ? 'primary' : 'on-surface-variant'}
                weight={focused ? 'bold' : 'semibold'}
                className="mt-space-xs"
              >
                {t.title}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
