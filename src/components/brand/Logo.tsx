import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { colors, elevation } from '@/theme/tokens';

const markSizes = {
  md: { box: 'h-10 w-10 rounded-2xl', glyph: 24 },
  sm: { box: 'h-7 w-7 rounded-lg', glyph: 17 },
} as const;

/** Location pin with an amber hub and route tick (login.html hero glyph). */
export function LogoMark({ size = 'md' }: { size?: keyof typeof markSizes }) {
  const s = markSizes[size];
  return (
    <View
      className={`items-center justify-center bg-primary ${s.box}`}
      style={size === 'md' ? { boxShadow: elevation.raised } : undefined}
    >
      <Svg width={s.glyph} height={s.glyph} viewBox="0 0 24 24">
        <Path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={colors['on-primary']}
        />
        <Circle cx={12} cy={9} r={3.2} fill={colors['brand-accent']} />
        <Path
          d="M12 9L15 6"
          stroke={colors['on-primary']}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** Mark + "RoadSense" wordmark. */
export function Logo() {
  return (
    <View
      className="flex-row items-center gap-2"
      accessibilityRole="image"
      accessibilityLabel="RoadSense"
    >
      <LogoMark />
      <Text variant="display-lg" importantForAccessibility="no">
        Road
        <Text variant="display-lg" tone="primary">
          Sense
        </Text>
      </Text>
    </View>
  );
}
