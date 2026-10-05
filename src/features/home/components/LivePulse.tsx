import { ImageBackground, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, elevation } from '@/theme/tokens';

import { livePulse } from '../homeMockData';

const metroPhoto = require('../../../../assets/images/metro-deccan.jpg');

/** Bottom-up scrim so the caption stays legible over the photo. */
function Scrim() {
  return (
    <Svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%">
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={colors['inverse-surface']} stopOpacity={0.8} />
          <Stop offset="0.6" stopColor={colors['inverse-surface']} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#scrim)" />
    </Svg>
  );
}

/** Live traffic + next-departure alerts. Static content for now. */
export function LivePulse() {
  const { traffic, metro, banner } = livePulse;

  return (
    <View
      className="gap-space-sm rounded-xl bg-surface-container-lowest p-space-md"
      style={{ boxShadow: elevation.card }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-space-xs">
          <View className="h-2.5 w-2.5 rounded-full bg-tertiary" />
          <Text variant="label-lg" role="heading">
            Pune Live Pulse
          </Text>
        </View>
        <Text variant="label-sm" tone="secondary">
          {livePulse.updated}
        </Text>
      </View>

      <View className="flex-row items-start gap-space-sm rounded-lg bg-error-container/40 p-space-sm">
        <View className="mt-0.5">
          <Icon name="warning-amber" size={20} tone="tertiary" />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="label-md" tone="on-error-container">
            {traffic.title}
          </Text>
          <Text variant="body-sm" tone="on-error-container">
            {traffic.body}
          </Text>
        </View>
      </View>

      <View className="flex-row items-start gap-space-sm rounded-lg bg-secondary-container/50 p-space-sm">
        <View className="mt-0.5">
          <Icon name="subway" size={20} tone="primary" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between">
            <Text variant="label-md" tone="on-secondary-container" className="shrink">
              {metro.station}
            </Text>
            <Text variant="label-sm" tone="primary" weight="bold">
              {metro.platform}
            </Text>
          </View>
          <Text variant="body-sm" tone="on-secondary-container">
            {metro.line} in{' '}
            <Text variant="body-sm" tone="primary" weight="bold" tabular>
              {metro.next}
            </Text>{' '}
            (Next in {metro.following}).
          </Text>
        </View>
      </View>

      <ImageBackground
        source={metroPhoto}
        resizeMode="cover"
        className="h-28 overflow-hidden rounded-lg bg-surface-container-high"
        accessibilityLabel="Pune Metro train at Deccan Gymkhana viaduct at dusk"
      >
        <Scrim />
        <View className="flex-1 flex-row items-end justify-between gap-space-sm p-space-sm">
          <Text variant="label-sm" tone="on-primary" className="shrink">
            {banner.caption}
          </Text>
          <View className="rounded bg-inverse-surface/60 px-2 py-0.5">
            <Text variant="label-sm" tone="primary-fixed" tabular>
              {banner.stat}
            </Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}
