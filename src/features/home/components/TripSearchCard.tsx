import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, elevation, fontFamilies, typography } from '@/theme/tokens';

const inputStyle = {
  fontFamily: fontFamilies.semibold,
  fontSize: typography['title-md'].fontSize,
  color: colors['on-surface'],
  padding: 0,
};

interface TripSearchCardProps {
  origin: string;
}

/** Stacked From / To inputs with a swap button and the Find Routes CTA. UI only for now. */
export function TripSearchCard({ origin }: TripSearchCardProps) {
  return (
    <View
      className="rounded-xl bg-surface-container-lowest p-space-md"
      style={{ boxShadow: elevation.raised }}
    >
      <View className="gap-space-sm">
        <View className="min-h-touch flex-row items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Icon name="my-location" size={18} tone="primary" />
          </View>
          <View className="min-w-0 flex-1">
            <Text variant="label-sm" tone="secondary">
              From current location
            </Text>
            <Text variant="title-md" numberOfLines={1}>
              {origin}
            </Text>
          </View>
        </View>

        <View className="min-h-touch flex-row items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
          <View
            className="h-8 w-8 items-center justify-center rounded-full bg-primary"
            style={{ boxShadow: elevation.card }}
          >
            <Icon name="location-on" size={18} tone="on-primary" />
          </View>
          <View className="min-w-0 flex-1">
            <Text variant="label-sm" tone="secondary">
              To destination
            </Text>
            <TextInput
              placeholder="Search destination, station or landmark..."
              placeholderTextColor={colors.secondary}
              accessibilityLabel="Destination"
              style={inputStyle}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Connector between the origin and destination icons. */}
        <View
          className="absolute left-[23px] top-[42px] h-7 w-0.5 bg-surface-variant"
          pointerEvents="none"
        />
        <Pressable
          className="absolute right-4 top-[38px] h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest active:scale-95"
          style={{ boxShadow: elevation.raised }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Swap origin and destination"
        >
          <Icon name="swap-vert" size={18} tone="primary" />
        </Pressable>
      </View>

      <Button
        label="Find Routes"
        iconRight="arrow-forward"
        leading={<Icon name="smart-toy" size={20} tone="on-primary" />}
        className="mt-space-md"
      />
    </View>
  );
}
