import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { Switch } from '@/components/routly/Switch';
import { colors, fonts, radius } from '@/theme/routly';
import { PressableBox } from '@/components/routly/PressableBox';

export const QUICK_LAUNCH_COMBOS = [
  { value: 'power+volume_up', label: 'Power + Volume Up' },
  { value: 'power+volume_down', label: 'Power + Volume Down' },
  { value: 'power_double', label: 'Double-press Power' },
] as const;

export const comboLabel = (value: string) =>
  QUICK_LAUNCH_COMBOS.find((c) => c.value === value)?.label ?? QUICK_LAUNCH_COMBOS[0].label;

interface QuickLaunchCardProps {
  enabled: boolean;
  combo: string;
  onToggle: (on: boolean) => void;
  onChangeCombo: () => void;
}

/**
 * Quick Launch settings (UI + preference only).
 *
 * TODO(quick-launch): third-party apps can't intercept Power + Volume combos on
 * Android or iOS. Viable triggers to build instead:
 * - Android: Quick Settings tile, home/lock-screen widget, app shortcut,
 *   Assistant / App Actions.
 * - iOS: Lock Screen widget, Shortcuts / Action Button (App Intents).
 * Flow: launch → "Where do you want to go?" (voice) → compact route picker →
 * the chosen route becomes a live mini-map widget.
 */
export function QuickLaunchCard({ enabled, combo, onToggle, onChangeCombo }: QuickLaunchCardProps) {
  const steps = [
    `Press ${comboLabel(combo)}`,
    'Say where you want to go',
    'Pick a route, it becomes a live mini-map',
  ];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconTile}>
          <Icon name="quick-launch" size={20} color={colors.accent} />
        </View>
        <View style={styles.titles}>
          <RText variant="cardTitle" color={colors.textOnPrimary}>
            Quick Launch
          </RText>
          <RText variant="caption" color={colors.dark.muted}>
            Works with screen off
          </RText>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          accessibilityLabel="Quick Launch"
          surface="dark"
        />
      </View>

      <View style={styles.steps}>
        {steps.map((text, i) => (
          <View
            key={i}
            style={styles.step}
            accessible
            accessibilityLabel={`Step ${i + 1}: ${text}`}
          >
            <RText variant="price" size={18} color={colors.accent}>
              {i + 1}
            </RText>
            <RText
              variant="small"
              family={fonts.bold}
              color={colors.textOnPrimary}
              style={styles.stepText}
            >
              {text}
            </RText>
          </View>
        ))}
      </View>

      <PressableBox
        onPress={onChangeCombo}
        accessibilityRole="button"
        accessibilityLabel="Change button combo"
        style={styles.outline}
        pressedStyle={styles.pressed}
      >
        <RText variant="body" size={13} family={fonts.bold} color={colors.textOnPrimary}>
          Change button combo
        </RText>
      </PressableBox>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.dark.base, borderRadius: radius.card, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.tileSm,
    backgroundColor: colors.dark.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, minWidth: 0 },
  steps: { flexDirection: 'row', gap: 8 },
  step: {
    flex: 1,
    backgroundColor: colors.dark.field,
    borderRadius: radius.tileSm,
    padding: 10,
    gap: 4,
  },
  stepText: { lineHeight: 11 * 1.35 },
  outline: {
    minHeight: 44,
    borderRadius: radius.tileSm,
    borderWidth: 1,
    borderColor: colors.dark.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.dark.field },
});
