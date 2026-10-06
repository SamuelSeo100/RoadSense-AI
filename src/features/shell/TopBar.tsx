import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/routly/IconButton';
import { RText } from '@/components/routly/RText';
import { colors, layout, radius } from '@/theme/routly';

import type { TopBarConfig } from './shellStore';

const logo = require('../../../assets/images/routly-icon.png');

/** White 72pt bar: logo, title, subtitle, search button. */
export function TopBar({ config }: { config: TopBarConfig | undefined }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bar, { paddingTop: insets.top, height: insets.top + layout.topBarHeight }]}
    >
      <View style={styles.row}>
        <Image source={logo} style={styles.logo} accessibilityLabel="Routly" />
        <View style={styles.titles}>
          <RText variant="screenTitle" accessibilityRole="header" numberOfLines={1}>
            {config?.title ?? 'Routly'}
          </RText>
          {!!config?.subtitle && (
            <RText variant="screenSub" numberOfLines={1}>
              {config.subtitle}
            </RText>
          )}
        </View>
        <IconButton
          icon="search"
          shape="round"
          active={config?.searchActive}
          accessibilityLabel={config?.searchLabel ?? 'Search routes'}
          accessibilityState={{ expanded: config?.searchActive ?? false }}
          onPress={() => config?.onSearch()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  logo: { width: 36, height: 36, borderRadius: radius.logo },
  titles: { flex: 1, minWidth: 0 },
});
