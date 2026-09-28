import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

interface CityBadgeProps {
  city: string;
}

export function CityBadge({ city }: CityBadgeProps) {
  return (
    <View
      className="rounded bg-surface-container-highest px-1.5 py-0.5"
      accessibilityLabel={`City: ${city}`}
    >
      <Text variant="label-sm" tone="on-surface-variant" caps>
        {city}
      </Text>
    </View>
  );
}
