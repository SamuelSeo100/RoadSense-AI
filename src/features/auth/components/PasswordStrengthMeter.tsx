import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, type ColorToken } from '@/theme/tokens';

import { getPasswordStrength, type PasswordStrength } from '../passwordStrength';

const levels: Record<PasswordStrength, { filled: number; tone: ColorToken; label: string }> = {
  weak: { filled: 1, tone: 'status-cancelled', label: 'Weak' },
  medium: { filled: 2, tone: 'status-delay', label: 'Medium' },
  strong: { filled: 3, tone: 'status-live', label: 'Strong' },
};

const SEGMENTS = 3;

/** Three-segment bar + label under the password field. Hidden until typing starts. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!strength) return null;
  const level = levels[strength];

  return (
    <View
      className="flex-row items-center gap-space-sm"
      accessibilityLabel={`Password strength: ${level.label}`}
      accessibilityLiveRegion="polite"
    >
      <View className="flex-1 flex-row gap-1">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View
            key={i}
            className="h-1 flex-1 rounded-full bg-surface-container-high"
            style={i < level.filled ? { backgroundColor: colors[level.tone] } : undefined}
          />
        ))}
      </View>
      <Text variant="label-sm" tone={level.tone} className="w-14 text-right">
        {level.label}
      </Text>
    </View>
  );
}
