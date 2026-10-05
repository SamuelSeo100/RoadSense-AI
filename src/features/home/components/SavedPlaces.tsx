import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { elevation } from '@/theme/tokens';

import { savedPlaces } from '../homeMockData';
import { SectionHeader } from './SectionHeader';

const tileClassName = 'flex-1 items-center rounded-xl p-space-sm';

export function SavedPlaces() {
  return (
    <View className="gap-space-xs">
      <SectionHeader title="Saved Places" actionLabel="Edit" />
      <View className="flex-row gap-space-xs">
        {savedPlaces.map((p) => (
          <Pressable
            key={p.id}
            className={cn(
              tileClassName,
              'bg-surface-container-lowest active:bg-surface-container-low',
            )}
            style={{ boxShadow: elevation.card }}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${p.area}, ${p.eta}`}
          >
            <View
              className={cn(
                'mb-1 h-10 w-10 items-center justify-center rounded-full',
                p.iconContainer,
              )}
            >
              <Icon name={p.icon} size={20} tone={p.iconTone} />
            </View>
            <Text variant="label-md" numberOfLines={1}>
              {p.name}
            </Text>
            <Text variant="body-sm" tone="secondary" numberOfLines={1}>
              {p.area}
            </Text>
            <View className="mt-1 rounded bg-surface-container px-1.5">
              <Text variant="label-sm" tone="primary" tabular>
                {p.eta}
              </Text>
            </View>
          </Pressable>
        ))}
        <Pressable
          className={cn(tileClassName, 'justify-center bg-surface-container-low active:scale-95')}
          style={{ boxShadow: elevation.card }}
          accessibilityRole="button"
          accessibilityLabel="Add place shortcut"
        >
          <View className="mb-1 h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest">
            <Icon name="add" size={20} tone="secondary" />
          </View>
          <Text variant="label-md" tone="primary" numberOfLines={1}>
            Add Place
          </Text>
          <Text variant="body-sm" tone="secondary" numberOfLines={1}>
            Shortcut
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
