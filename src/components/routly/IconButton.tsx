import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows } from '@/theme/routly';

import { Icon, type IconName } from './Icon';
import { PressableBox } from './PressableBox';

interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** `round` 44 (top bar), `square` 44 r12 (swap, map controls), `close` 36 round on grey. */
  shape?: 'round' | 'square' | 'close';
  /** Solid primary with a white icon (active search). */
  active?: boolean;
  /** Floating on the map: no border, map-control shadow. */
  floating?: boolean;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityState?: { expanded?: boolean; selected?: boolean };
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  shape = 'square',
  active = false,
  floating = false,
  iconColor,
  style,
  accessibilityState,
}: IconButtonProps) {
  const size = shape === 'close' ? 36 : 44;
  return (
    <PressableBox
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      hitSlop={shape === 'close' ? 4 : 0}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === 'square' ? radius.iconBtn : size / 2,
        },
        shape === 'close'
          ? styles.close
          : active
            ? styles.active
            : floating
              ? [styles.idle, styles.floating]
              : [styles.idle, styles.bordered],
        style,
      ]}
      pressedStyle={styles.pressed}
    >
      <Icon
        name={icon}
        size={shape === 'close' ? 18 : 20}
        color={iconColor ?? (active ? colors.textOnPrimary : colors.textPrimary)}
      />
    </PressableBox>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  idle: { backgroundColor: colors.surface },
  bordered: { borderWidth: 1, borderColor: colors.border },
  floating: shadows.mapControl,
  active: { backgroundColor: colors.primary },
  close: { backgroundColor: colors.background },
  pressed: { opacity: 0.75 },
});
