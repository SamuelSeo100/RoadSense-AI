import { Pressable, StyleSheet } from 'react-native';

import { colors, fonts } from '@/theme/routly';

import { Icon, type IconName } from './Icon';
import { RText } from './RText';

interface ToggleTileProps {
  label: string;
  icon: IconName;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** Vehicle filter tile (Routes › Include vehicles). */
export function ToggleTile({ label, icon, value, onValueChange }: ToggleTileProps) {
  const tint = value ? colors.primary : colors.iconInactive;
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="checkbox"
      accessibilityLabel={`Include ${label.toLowerCase()} routes`}
      accessibilityState={{ checked: value }}
      style={[styles.tile, value ? styles.on : styles.off]}
    >
      <Icon name={icon} size={26} color={tint} />
      <RText variant="body" size={12} family={fonts.bold} color={tint}>
        {label}
      </RText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  on: { backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: colors.primary },
  // 1px border + 1px padding keeps the content from shifting when toggled.
  off: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 1,
  },
});
