import { StyleSheet, View } from 'react-native';

import { RText } from '@/components/routly/RText';
import { colors } from '@/theme/routly';

import type { LiveMapProps } from './LiveMap';

/** react-native-maps has no web renderer: show a flat map-coloured backdrop instead. */
export function LiveMap({ insets }: LiveMapProps) {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.map]}
      accessibilityLabel="Map (not available on web)"
    >
      <View style={[styles.note, { top: insets.top + 120 }]}>
        <RText variant="caption">The live map is available in the mobile app.</RText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: colors.map.land },
  note: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
