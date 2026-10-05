import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, elevation } from '@/theme/tokens';

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Stylized Mula-Mutha river and arterial roads behind the greeting. */
function CityUnderlay() {
  return (
    <View className="absolute inset-0 opacity-20" pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice">
        <Path
          d="M-20 60 C80 90, 140 30, 240 70 C300 95, 340 50, 390 60"
          stroke={colors['primary-container']}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M40 0 L120 140 M160 0 L220 140 M280 0 L210 140"
          stroke={colors.outline}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <Path d="M0 45 L360 95" stroke={colors.outline} strokeWidth={2} />
        <Circle cx={210} cy={72} r={4} fill={colors.primary} />
        <Circle cx={130} cy={56} r={4} fill={colors.tertiary} />
      </Svg>
    </View>
  );
}

interface GreetingCardProps {
  name: string;
  area: string;
}

export function GreetingCard({ name, area }: GreetingCardProps) {
  const firstName = name.split(' ')[0];
  const greeting = greetingFor(new Date().getHours());

  return (
    <View
      className="overflow-hidden rounded-xl bg-surface-container-low p-space-md"
      style={{ boxShadow: elevation.card }}
    >
      <CityUnderlay />
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-space-xs">
          <View className="flex-row items-center gap-space-xs">
            <Text variant="headline-md" role="heading" numberOfLines={1} className="shrink">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </Text>
            <View className="rounded-full bg-primary/10 px-space-xs py-0.5">
              <Text variant="label-sm" tone="primary">
                PMC
              </Text>
            </View>
          </View>
          <View className="mt-space-xs flex-row items-center gap-space-xs">
            <Pressable
              className="flex-row items-center gap-1 rounded-full bg-surface-container-lowest px-space-sm py-1"
              style={{ boxShadow: elevation.card }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="City: Pune. Change city"
            >
              <View className="h-2 w-2 rounded-full bg-primary" />
              <Text variant="label-md">Pune</Text>
              <Icon name="expand-more" size={16} tone="secondary" />
            </Pressable>
            <Text variant="body-sm" tone="secondary" numberOfLines={1} className="shrink">
              Live GPS Active · {area}
            </Text>
          </View>
        </View>
        <View>
          <View
            className="h-12 w-12 items-center justify-center rounded-full bg-primary-fixed"
            style={{ boxShadow: elevation.card }}
            accessibilityLabel={`${name} avatar`}
          >
            <Text variant="title-md" tone="on-primary-fixed">
              {initialsOf(name) || '?'}
            </Text>
          </View>
          <View
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest bg-primary"
            accessibilityLabel="Commute mode active"
          />
        </View>
      </View>
    </View>
  );
}
