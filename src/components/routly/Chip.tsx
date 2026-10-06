import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, fonts, radius } from '@/theme/routly';

import { RText } from './RText';

interface ChipProps {
  label: string;
  onPress: () => void;
  /** Present for single-select chips (priority); omit for action chips. */
  selected?: boolean;
  /** 44 (Routes priority), 38 (Profile priority), 36 (quick/suggestion chips). */
  height?: 44 | 38 | 36;
  /** `dark` = outline chip on a dark card (AI suggestions). */
  surface?: 'light' | 'dark';
  leading?: ReactNode;
  accessibilityLabel?: string;
}

/** Pill chip. Selected = navy fill + white text; unselected = white + strong border. */
export function Chip({
  label,
  onPress,
  selected,
  height = 44,
  surface = 'light',
  leading,
  accessibilityLabel,
}: ChipProps) {
  const isDark = surface === 'dark';
  const on = selected === true;
  const fontSize = height === 44 ? 14 : 12;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected: on, checked: on }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={height < 44 ? (44 - height) / 2 : 0}
      style={({ pressed }) => [
        styles.chip,
        { minHeight: height, paddingHorizontal: height === 44 ? 16 : 14 },
        isDark ? styles.dark : on ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      {leading}
      <RText
        variant="body"
        size={fontSize}
        family={isDark ? fonts.semibold : fonts.bold}
        color={isDark ? colors.dark.chipText : on ? colors.textOnPrimary : colors.textPrimary}
      >
        {label}
      </RText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selected: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  unselected: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  dark: { backgroundColor: 'transparent', borderColor: colors.dark.outline },
  pressed: { opacity: 0.8 },
});
