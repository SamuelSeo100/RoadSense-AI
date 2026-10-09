import { StyleSheet, View } from 'react-native';

import { RText } from '@/components/routly/RText';
import { colors } from '@/theme/routly';

import type { PinMapProps } from './PinMap';

/** react-native-maps has no web renderer: the pin stays where it started. */
export function PinMap(_props: PinMapProps) {
  return (
    <View style={styles.frame}>
      <RText variant="caption">Moving the pin is available in the mobile app.</RText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.map.land,
  },
});
