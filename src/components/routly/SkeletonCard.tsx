import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '@/theme/routly';

/** Loading placeholder shaped like a RouteCard (pulsing shimmer). */
export function SkeletonCard() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.card} accessibilityLabel="Loading routes" accessibilityRole="progressbar">
      <Animated.View style={[styles.content, animated]}>
        <View style={styles.row}>
          <View style={[styles.bar, { width: 90, height: 28 }]} />
          <View style={[styles.bar, { width: 60, height: 24 }]} />
        </View>
        <View style={styles.row}>
          <View style={[styles.bar, { width: 70, height: 28 }]} />
          <View style={[styles.bar, { width: 80, height: 28 }]} />
          <View style={[styles.bar, { width: 64, height: 28 }]} />
        </View>
        <View style={[styles.bar, { width: '100%', height: 36 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
  },
  content: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  bar: { backgroundColor: colors.skeleton, borderRadius: 8 },
});
