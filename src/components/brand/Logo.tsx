import { Image, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { elevation } from '@/theme/tokens';

const logoMark = require('../../../assets/images/logo-mark.png');

const markSizes = {
  md: { box: 'h-10 w-10 rounded-2xl', glyph: 26 },
  sm: { box: 'h-7 w-7 rounded-lg', glyph: 18 },
} as const;

/** Routly "R" mark on the off-white app-icon tile. */
export function LogoMark({ size = 'md' }: { size?: keyof typeof markSizes }) {
  const s = markSizes[size];
  return (
    <View
      className={`items-center justify-center ${s.box}`}
      style={{
        backgroundColor: '#FBFAF6',
        boxShadow: size === 'md' ? elevation.raised : undefined,
      }}
    >
      <Image
        source={logoMark}
        style={{ width: s.glyph, height: s.glyph }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** Mark + "Routly" wordmark. */
export function Logo() {
  return (
    <View
      className="flex-row items-center gap-2"
      accessibilityRole="image"
      accessibilityLabel="Routly"
    >
      <LogoMark />
      <Text variant="display-lg" importantForAccessibility="no">
        Rout
        <Text variant="display-lg" tone="primary">
          ly
        </Text>
      </Text>
    </View>
  );
}
