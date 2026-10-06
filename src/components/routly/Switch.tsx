import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/routly';

const TRACK_W = 52;
const TRACK_H = 30;
const KNOB = 24;
const PAD = 3;

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  /** `dark` = on dark cards (mint when on). */
  surface?: 'light' | 'dark';
}

/** 52×30 switch from the design system. */
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  surface = 'light',
}: SwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 160 });
  }, [progress, value]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK_W - KNOB - PAD * 2) }],
  }));

  const onColor = surface === 'dark' ? colors.accent : colors.primary;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[styles.track, { backgroundColor: value ? onColor : colors.toggleOff }]}
    >
      <Animated.View style={[styles.knob, knobStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: PAD },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.surface },
});
