import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/routly';

import type { NavigationMapProps } from './NavigationMap';

/** react-native-maps has no web renderer: a flat backdrop behind the instruction card. */
export function NavigationMap(_props: NavigationMapProps) {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.map]}
      accessibilityLabel="Map (not available on web)"
    />
  );
}

const styles = StyleSheet.create({ map: { backgroundColor: colors.map.land } });
