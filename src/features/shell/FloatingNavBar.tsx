import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/routly/Icon';
import { colors, layout, radius, shadows } from '@/theme/routly';

import { TABS, tabInfo, type TabName } from './tabs';

const { width: NAV_W, height: NAV_H, bottomOffset, activeSize, inactiveSize } = layout.navBar;

interface FloatingNavBarProps {
  active: TabName;
  onSelect: (tab: TabName) => void;
}

/** Floating pill tab bar: icons only, the active tab a raised teal circle. */
export function FloatingNavBar({ active, onSelect }: FloatingNavBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        shadows.navBar,
        { bottom: insets.bottom + bottomOffset, width: Math.min(NAV_W, width - 32) },
      ]}
    >
      {TABS.map((tab) => {
        const on = tab === active;
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tabInfo[tab].label}
            accessibilityState={{ selected: on }}
            style={[styles.item, on ? [styles.active, shadows.navActive] : styles.inactive]}
          >
            <Icon
              name={tabInfo[tab].icon}
              size={24}
              color={on ? colors.textOnPrimary : colors.iconInactive}
              strokeWidth={on ? 2.2 : 1.9}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    height: NAV_H,
    borderRadius: NAV_H / 2,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  active: { width: activeSize, height: activeSize, backgroundColor: colors.primary },
  inactive: { width: inactiveSize, height: inactiveSize },
});
