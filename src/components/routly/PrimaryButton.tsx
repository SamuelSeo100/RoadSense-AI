import { StyleSheet } from 'react-native';

import { colors, radius } from '@/theme/routly';

import { Icon, type IconName } from './Icon';
import { RText } from './RText';
import { PressableBox } from './PressableBox';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** 52 on Home, 48 inside the Plan-a-route panel. */
  height?: 52 | 48;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  accessibilityHint?: string;
}

export function PrimaryButton({
  label,
  onPress,
  height = 52,
  leadingIcon,
  trailingIcon,
  accessibilityHint,
}: PrimaryButtonProps) {
  return (
    <PressableBox
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[styles.button, { minHeight: height }]}
      pressedStyle={styles.pressed}
    >
      {leadingIcon && (
        <Icon name={leadingIcon} size={18} color={colors.textOnPrimary} strokeWidth={2.2} />
      )}
      <RText variant="button" numberOfLines={1}>
        {label}
      </RText>
      {trailingIcon && (
        <Icon name={trailingIcon} size={18} color={colors.textOnPrimary} strokeWidth={2.2} />
      )}
    </PressableBox>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.primaryPressed },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
});
