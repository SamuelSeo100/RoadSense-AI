import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';

/** Tailwind `animate-pulse`: opacity 1 → 0.5, 2s cycle. */
const PULSE_HALF_CYCLE_MS = 1000;
const PULSE_MIN_OPACITY = 0.5;

function PulseDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_HALF_CYCLE_MS,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View className="h-2 w-2 rounded-full bg-primary" style={style} />;
}

/** "Supporting Pune Metro, PMPML…" strip under the login card. */
export function CoverageBanner() {
  return (
    <View className="flex-row items-center justify-center gap-2 rounded-xl bg-surface-container px-3 py-2.5">
      <PulseDot />
      <Text
        variant="label-sm"
        tone="on-surface-variant"
        weight="medium"
        className="flex-shrink text-center"
      >
        Supporting Pune Metro, PMPML, Suburban Rail & Auto Corridors
      </Text>
    </View>
  );
}
